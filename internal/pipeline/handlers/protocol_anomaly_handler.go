package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/model"
	"github.com/iodesk/VibesWAF/internal/pipeline"
	"github.com/iodesk/VibesWAF/internal/repository"
)

type protocolAnomalyState struct {
	rules map[string]int
}

type ProtocolViolation struct {
	Type   string `json:"type"`
	Score  int    `json:"score"`
	Detail string `json:"detail"`
}

type ProtocolEvidence struct {
	Violations []ProtocolViolation `json:"violations"`
	JA4        string `json:"ja4,omitempty"`
	JA4H       string `json:"ja4h,omitempty"`
}

type ProtocolAnomalyHandler struct {
	getScoringConfig func() *model.ScoringConfig
	settingsRepo     *repository.SettingsRepository
	appCfg           *config.AppConfig

	state  unsafe.Pointer // *protocolAnomalyState
	mu     sync.Mutex
	stopCh chan struct{}
}

func NewProtocolAnomalyHandler(getScoringConfig func() *model.ScoringConfig, settingsRepo *repository.SettingsRepository) *ProtocolAnomalyHandler {
	h := &ProtocolAnomalyHandler{
		getScoringConfig: getScoringConfig,
		settingsRepo:     settingsRepo,
		appCfg:           config.GetAppConfig(),
		stopCh:           make(chan struct{}),
	}

	initial := h.loadState()
	atomic.StorePointer(&h.state, unsafe.Pointer(initial))
	go h.autoReload()

	return h
}

func (h *ProtocolAnomalyHandler) loadState() *protocolAnomalyState {
	cfg, err := h.settingsRepo.GetProtocolAnomalyConfig()
	if err != nil {
		h.appCfg.LogWarn("[PROTOCOL_ANOMALY] Failed to load config: %v", err)
		cfg = model.DefaultProtocolAnomalyConfig()
	}
	return &protocolAnomalyState{rules: cfg.Rules}
}

func (h *ProtocolAnomalyHandler) autoReload() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-h.stopCh:
			return
		case <-ticker.C:
			next := h.loadState()
			atomic.StorePointer(&h.state, unsafe.Pointer(next))
		}
	}
}

func (h *ProtocolAnomalyHandler) getState() *protocolAnomalyState {
	return (*protocolAnomalyState)(atomic.LoadPointer(&h.state))
}

func (h *ProtocolAnomalyHandler) ruleScore(name string) int {
	st := h.getState()
	if v, ok := st.rules[name]; ok {
		return v
	}
	return 0
}

func (h *ProtocolAnomalyHandler) Handle(ctx *pipeline.Context) error {
	if ctx.HardDecision {
		ctx.AddTrace(pipeline.StageTrace{Stage: "protocol_anomaly", Result: "SKIP"})
		return nil
	}

	if ctx.ChallengePassed {
		ctx.AddTrace(pipeline.StageTrace{Stage: "protocol_anomaly", Result: "SKIP"})
		return nil
	}

	if ctx.ShouldSkipModule("protocol_anomaly") {
		ctx.AddTrace(pipeline.StageTrace{Stage: "protocol_anomaly", Result: "SKIP"})
		return nil
	}

	if ctx.IsPhaseSkipped("protocol_anomaly") {
		ctx.AddTrace(pipeline.StageTrace{Stage: "protocol_anomaly", Result: "SKIP"})
		return nil
	}

	var score int
	var reasons []string
	violations := make([]ProtocolViolation, 0)

	headerScore, headerReasons, headerViolations := h.checkHeaderInconsistency(ctx)
	score += headerScore
	reasons = append(reasons, headerReasons...)
	violations = append(violations, headerViolations...)

	cookieScore, cookieReasons, cookieViolations := h.checkCookieAnomaly(ctx)
	score += cookieScore
	reasons = append(reasons, cookieReasons...)
	violations = append(violations, cookieViolations...)

	ja4Score, ja4Reasons, ja4Violations := h.checkJA4Anomaly(ctx)
	score += ja4Score
	reasons = append(reasons, ja4Reasons...)
	violations = append(violations, ja4Violations...)

	if score > 0 {
		h.appCfg.LogDebug("[PROTOCOL_ANOMALY] Contributed score=%d for ip=%s", score, ctx.ClientIP)
		evidence := ProtocolEvidence{
			Violations: violations,
			JA4:        ctx.GetExtraString("ja4"),
			JA4H:       ctx.GetExtraString("ja4h"),
		}
		evidenceJSON, _ := json.Marshal(evidence)
		ctx.AddTrace(pipeline.StageTrace{
			Stage:    "protocol_anomaly",
			Score:    score,
			Reason:   joinReasons(reasons),
			Evidence: json.RawMessage(evidenceJSON),
		})
	} else {
		ctx.AddTrace(pipeline.StageTrace{Stage: "protocol_anomaly", Score: 0})
	}

	return nil
}

func (h *ProtocolAnomalyHandler) checkHeaderInconsistency(ctx *pipeline.Context) (int, []string, []ProtocolViolation) {
	r := ctx.Request
	var score int
	var reasons []string
	violations := make([]ProtocolViolation, 0)

	if r.ProtoMajor >= 2 && r.Header.Get("Connection") != "" {
		s := h.ruleScore("http2_connection_header")
		if s > 0 {
			ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "http2_connection_header", s)
			score += s
			reasons = append(reasons, "HTTP/2 Connection header")
			violations = append(violations, ProtocolViolation{Type: "http2_connection_header", Score: s, Detail: "HTTP/2 with Connection header"})
		}
	}

	method := strings.ToUpper(r.Method)
	if (method == "GET" || method == "HEAD") && r.Header.Get("Content-Type") != "" {
		s := h.ruleScore("content_type_no_body")
		if s > 0 {
			ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "content_type_no_body", s)
			score += s
			reasons = append(reasons, "Content-Type on bodyless request")
			violations = append(violations, ProtocolViolation{Type: "content_type_no_body", Score: s, Detail: "Content-Type on GET/HEAD"})
		}
	}

	accept := r.Header.Get("Accept")
	path := ctx.Normalized.Path
	if accept != "" && strings.Contains(accept, "text/html") && !strings.Contains(accept, "*/*") {
		if isAPIPath(path) {
			s := h.ruleScore("accept_path_mismatch")
			if s > 0 {
				ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "accept_path_mismatch", s)
				score += s
				reasons = append(reasons, "Accept/path mismatch")
				violations = append(violations, ProtocolViolation{Type: "accept_path_mismatch", Score: s, Detail: "text/html on API path"})
			}
		}
	}

	secFetchDest := r.Header.Get("Sec-Fetch-Dest")
	if secFetchDest == "document" {
		if isAssetOrAPIPath(path) {
			s := h.ruleScore("sec_fetch_dest_mismatch")
			if s > 0 {
				ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "sec_fetch_dest_mismatch", s)
				score += s
				reasons = append(reasons, "Sec-Fetch-Dest mismatch")
				violations = append(violations, ProtocolViolation{Type: "sec_fetch_dest_mismatch", Score: s, Detail: "Sec-Fetch-Dest: document on asset"})
			}
		}
	}

	if r.Header.Get("Upgrade-Insecure-Requests") == "1" {
		secFetchMode := r.Header.Get("Sec-Fetch-Mode")
		if secFetchMode != "" && secFetchMode != "navigate" {
			s := h.ruleScore("upgrade_non_navigate")
			if s > 0 {
				ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "upgrade_non_navigate", s)
				score += s
				reasons = append(reasons, "Upgrade-Insecure-Requests non-navigate")
				violations = append(violations, ProtocolViolation{Type: "upgrade_non_navigate", Score: s, Detail: "UIR on non-navigate request"})
			}
		}
	}

	if r.Header.Get("Transfer-Encoding") != "" && r.Header.Get("Content-Length") != "" {
		s := h.ruleScore("te_cl_conflict")
		if s > 0 {
			ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "te_cl_conflict", s)
			score += s
			reasons = append(reasons, "TE/CL conflict")
			violations = append(violations, ProtocolViolation{Type: "te_cl_conflict", Score: s, Detail: "Both TE and CL headers present"})
		}
	}

	if hosts := r.Header.Values("Host"); len(hosts) > 1 {
		s := h.ruleScore("multiple_host_headers")
		if s > 0 {
			ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "multiple_host_headers", s)
			score += s
			reasons = append(reasons, "Multiple Host headers")
			violations = append(violations, ProtocolViolation{Type: "multiple_host_headers", Score: s, Detail: "Multiple Host headers"})
		}
	}

	return score, reasons, violations
}

func (h *ProtocolAnomalyHandler) checkCookieAnomaly(ctx *pipeline.Context) (int, []string, []ProtocolViolation) {
	r := ctx.Request
	var score int
	var reasons []string
	violations := make([]ProtocolViolation, 0)

	cookie, err := r.Cookie("ok")
	if err == nil && cookie.Value != "" {
		if !h.isValidChallengeFormat(cookie.Value) {
			s := h.ruleScore("malformed_challenge_cookie")
			if s > 0 {
				ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "malformed_challenge_cookie", s)
				score += s
				reasons = append(reasons, "Malformed challenge cookie")
				violations = append(violations, ProtocolViolation{Type: "malformed_challenge_cookie", Score: s, Detail: "Invalid cookie format"})
			}
		} else if h.isCookieTimestampFuture(cookie.Value) {
			s := h.ruleScore("future_cookie_timestamp")
			if s > 0 {
				ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "future_cookie_timestamp", s)
				score += s
				reasons = append(reasons, "Future cookie timestamp")
				violations = append(violations, ProtocolViolation{Type: "future_cookie_timestamp", Score: s, Detail: "Cookie timestamp in future"})
			}
		}
	}

	cookieHeader := r.Header.Get("Cookie")
	if cookieHeader != "" {
		cookieCount := strings.Count(cookieHeader, "=")
		path := ctx.Normalized.Path
		if cookieCount > 10 && (path == "/" || path == "") {
			referer := r.Header.Get("Referer")
			if referer == "" {
				s := h.ruleScore("excessive_cookies_no_referer")
				if s > 0 {
					ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "excessive_cookies_no_referer", s)
					score += s
					reasons = append(reasons, "Excessive cookies without referer")
					violations = append(violations, ProtocolViolation{Type: "excessive_cookies_no_referer", Score: s, Detail: "Many cookies without referer"})
				}
			}
		}
	}

	return score, reasons, violations
}

func (h *ProtocolAnomalyHandler) isValidChallengeFormat(value string) bool {
	parts := strings.Split(value, ".")
	if len(parts) < 2 || len(parts) > 3 {
		return false
	}
	if len(parts[0]) != 32 && len(parts[0]) != 64 {
		return false
	}
	_, err := strconv.ParseInt(parts[1], 10, 64)
	return err == nil
}
func (h *ProtocolAnomalyHandler) isCookieTimestampFuture(value string) bool {
	parts := strings.Split(value, ".")
	if len(parts) < 2 || len(parts) > 3 {
		return false
	}
	timestamp, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return false
	}
	return timestamp > time.Now().Unix()+60
}

// setFingerprintHashes extracts header names hash from JA4H and computes UA hash,
// then sets context keys for display and stable session tracking.
//
// JA4H format: ja4h_<A>_<B>_<C>_<D>
//   B = SHA256(header names in request order), 12 hex ← parts[2], header names hash
//   C = SHA256(cookie names sorted), 12 hex
//   D = SHA256(cookie values sorted), 12 hex
//
// This function extracts B (header hash) for stable session fingerprinting,
// and computes a separate UA hash for real UA consistency tracking.
func (h *ProtocolAnomalyHandler) setFingerprintHashes(ctx *pipeline.Context, ja4h string) {
	// Extract header names hash from JA4H (parts[2] = B segment)
	headerHash := extractHeaderHashFromJA4H(ja4h)
	if headerHash != "" {
		ctx.SetExtra("ja4h_header_hash", headerHash)
	}

	// Compute UA hash from current request
	uaHash := hashUAValue(ctx.Normalized.UA)
	if uaHash != "" {
		ctx.SetExtra("ua_hash", uaHash)
	}
}

// extractHeaderHashFromJA4H parses JA4H to get the header names hash (B segment).
// The B segment is SHA256 of header names in request order, NOT a UA hash.
// Format: ja4h_[A]_[B]_[C]_[D]
// Example: ja4h_ge20nn140000_78159df7d8ea_000000000000_000000000000
func extractHeaderHashFromJA4H(ja4h string) string {
	if !strings.HasPrefix(ja4h, "ja4h_") {
		return ""
	}

	parts := strings.Split(ja4h, "_")
	// Index: 0=ja4h, 1=A(method+flags), 2=B(header names hash), 3=C, 4=D
	if len(parts) >= 3 {
		return parts[2]
	}
	return ""
}

// hashUAValue computes SHA256 of User-Agent string, truncated to 12 hex chars.
// Used for UA consistency tracking across requests in the same stable session.
func hashUAValue(ua string) string {
	if ua == "" {
		return ""
	}
	hash := sha256.Sum256([]byte(strings.ToLower(ua)))
	return hex.EncodeToString(hash[:])[:12]
}

func (h *ProtocolAnomalyHandler) checkJA4Anomaly(ctx *pipeline.Context) (int, []string, []ProtocolViolation) {
	r := ctx.Request
	var score int
	var reasons []string
	violations := make([]ProtocolViolation, 0)

	ja4 := r.Header.Get("X-JA4")
	ja4h := r.Header.Get("X-JA4H")

	if ja4 != "" {
		ctx.SetExtra("ja4", ja4)
	}
	if ja4h != "" {
		ctx.SetExtra("ja4h", ja4h)
	}

	// Extract header hash from JA4H and compute UA hash for fingerprinting
	h.setFingerprintHashes(ctx, ja4h)

	ua := strings.ToLower(ctx.Normalized.UA)
	isBrowserUA := strings.Contains(ua, "mozilla") && (strings.Contains(ua, "chrome") || strings.Contains(ua, "safari") || strings.Contains(ua, "firefox"))
	isBotUA := strings.Contains(ua, "bot") || strings.Contains(ua, "crawler") || strings.Contains(ua, "spider") || strings.Contains(ua, "curl") || strings.Contains(ua, "python") || strings.Contains(ua, "go-http")

	if isBrowserUA && r.ProtoMajor == 1 && r.ProtoMinor == 0 {
		s := h.ruleScore("browser_ua_http10")
		if s > 0 {
			ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "browser_ua_http10", s)
			score += s
			reasons = append(reasons, "Browser UA with HTTP/1.0")
			violations = append(violations, ProtocolViolation{Type: "browser_ua_http10", Score: s, Detail: "Browser UA with HTTP/1.0"})
		}
	}

	// TLS 1.0/1.1 is scored regardless of User-Agent: nginx already refuses
	// these protocols, so a fingerprint reporting them means the TLS layer was
	// loosened or the header was forged. The browser variant keeps its own
	// tunable score.
	if tlsVer := ja4TLSSegment(ja4); tlsVer == "10" || tlsVer == "11" {
		rule := "ja4_old_tls"
		reason := "Old TLS version"
		if isBrowserUA {
			rule = "ja4_old_tls_browser_ua"
			reason = "Old TLS with browser UA"
		}
		if s := h.ruleScore(rule); s > 0 {
			ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, rule, s)
			score += s
			reasons = append(reasons, reason)
			violations = append(violations, ProtocolViolation{Type: rule, Score: s, Detail: reason})
		}
	}

	if isBrowserUA && ja4 == "" && r.TLS != nil {
		s := h.ruleScore("browser_ua_ja4_empty")
		if s > 0 {
			ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "browser_ua_ja4_empty", s)
			score += s
			reasons = append(reasons, "Missing JA4 on TLS browser request")
			violations = append(violations, ProtocolViolation{Type: "browser_ua_ja4_empty", Score: s, Detail: "TLS request without JA4"})
		}
	}

	if isBotUA && ja4 != "" && len(ja4) >= 7 {
		if ja4[3] == 'd' {
			cipherCountStr := ja4[4:6]
			if cipherCount, err := strconv.Atoi(cipherCountStr); err == nil && cipherCount >= 12 {
				s := h.ruleScore("bot_ua_browser_ja4")
				if s > 0 {
					ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "bot_ua_browser_ja4", s)
					score += s
					reasons = append(reasons, "Bot UA with browser-like JA4")
					violations = append(violations, ProtocolViolation{Type: "bot_ua_browser_ja4", Score: s, Detail: "Bot UA with browser-like TLS"})
				}
			}
		}
	}

	if isBrowserUA && ja4 != "" && len(ja4) >= 7 {
		if ja4[3] == 'd' {
			cipherCountStr := ja4[4:6]
			if cipherCount, err := strconv.Atoi(cipherCountStr); err == nil && cipherCount <= 4 {
				s := h.ruleScore("browser_ua_simple_ja4")
				if s > 0 {
					ctx.AddScore(pipeline.ScoreCategoryProtocolAnomaly, "browser_ua_simple_ja4", s)
					score += s
					reasons = append(reasons, "Browser UA with simple JA4")
					violations = append(violations, ProtocolViolation{Type: "browser_ua_simple_ja4", Score: s, Detail: "Browser UA with minimal cipher count"})
				}
			}
		}
	}

	return score, reasons, violations
}

// ja4TLSSegment returns the two-character TLS version segment of a JA4
// fingerprint, or an empty string when the fingerprint is missing or too short
// to parse.
func ja4TLSSegment(ja4 string) string {
	if len(ja4) < 3 {
		return ""
	}
	return ja4[1:3]
}

func isAPIPath(path string) bool {
	apiPrefixes := []string{"/api/", "/graphql", "/rest/", "/v1/", "/v2/"}
	apiSuffixes := []string{".json", ".xml", ".yaml", ".proto"}
	for _, prefix := range apiPrefixes {
		if strings.HasPrefix(path, prefix) {
			return true
		}
	}
	for _, suffix := range apiSuffixes {
		if strings.HasSuffix(path, suffix) {
			return true
		}
	}
	return false
}

func isAssetOrAPIPath(path string) bool {
	if isAPIPath(path) {
		return true
	}
	assetSuffixes := []string{
		".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg",
		".woff", ".woff2", ".ttf", ".ico", ".webp", ".avif",
	}
	for _, suffix := range assetSuffixes {
		if strings.HasSuffix(path, suffix) {
			return true
		}
	}
	return false
}
