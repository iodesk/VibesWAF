package waf

import (
	"bytes"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	coreruleset "github.com/corazawaf/coraza-coreruleset/v4"
	"github.com/corazawaf/coraza/v3"
	"github.com/corazawaf/coraza/v3/types"
)

type MatchedRuleInfo struct {
	RuleID   int    `json:"rule_id"`
	Severity int    `json:"severity"`
	Category string `json:"category"`
	Message  string `json:"message"`
}

type WAFResult struct {
	AnomalyScore int               `json:"anomaly_score"`
	TriggerRule  string            `json:"trigger_rule"`
	MatchedRules []MatchedRuleInfo `json:"matched_rules"`
}

type CorazaEngine struct {
	waf       coraza.WAF
	appConfig AppConfig
	dataDir   string
}

type AppConfig interface {
	LogInfo(format string, v ...interface{})
	LogDebug(format string, v ...interface{})
	LogError(format string, v ...interface{})
}

func NewCorazaEngine(paranoiaLevel int, anomalyThreshold int, outboundAnomalyThreshold int, allowedMethods []string, disabledRules []int, customRules string, appConfig AppConfig) (*CorazaEngine, error) {
	// Extract CRS files to disk (required for Windows path separator compatibility)
	dataDir := filepath.Join("data", "coraza-crs")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data dir: %w", err)
	}

	// Extract files from embedded FS
	if err := extractCRSFiles(coreruleset.FS, dataDir); err != nil {
		return nil, fmt.Errorf("failed to extract CRS files: %w", err)
	}

	// Build allowed methods string
	methodsStr := strings.Join(allowedMethods, " ")

	// Build disabled rules directives
	var disabledRulesDirectives string
	for _, ruleID := range disabledRules {
		disabledRulesDirectives += fmt.Sprintf("SecRuleRemoveById %d\n", ruleID)
	}

	// Use extracted files with OS filesystem
	cfg := coraza.NewWAFConfig().
		WithRootFS(os.DirFS(dataDir)).
		WithDirectives(fmt.Sprintf(`
# --- CORE---
Include @coraza.conf-recommended

# --- Enable blocking mode (not just detection) ---
SecRuleEngine On

# --- Audit logging ---
#SecAuditLog logs/coraza-audit.log

# --- CRS setup---
Include @crs-setup.conf.example

# --- Override CRS config ---
SecAction "id:900000,phase:1,pass,nolog,setvar:tx.blocking_paranoia_level=%d"
SecAction "id:900110,phase:1,pass,nolog,setvar:tx.inbound_anomaly_score_threshold=%d,setvar:tx.outbound_anomaly_score_threshold=%d"
SecAction "id:900200,phase:1,pass,nolog,setvar:'tx.allowed_methods=%s'"

# --- Disable specific rules (e.g., Cloudflare compatibility) ---
%s

# --- CRS rules ---
Include @owasp_crs/*.conf

# --- Custom Rules (User-defined) ---
%s
`, paranoiaLevel, anomalyThreshold, outboundAnomalyThreshold, methodsStr, disabledRulesDirectives, customRules))

	waf, err := coraza.NewWAF(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Coraza WAF: %w", err)
	}

	// Log successful initialization
	appConfig.LogInfo("[CORAZA] Configuration: Paranoia Level=%d, Inbound Threshold=%d, Outbound Threshold=%d", paranoiaLevel, anomalyThreshold, outboundAnomalyThreshold)
	appConfig.LogInfo("[CORAZA] Allowed Methods: %s", strings.Join(allowedMethods, ", "))
	appConfig.LogInfo("[CORAZA] Disabled Rules: %v", disabledRules)
	if customRules != "" {
		appConfig.LogInfo("[CORAZA] Custom Rules: %d bytes loaded", len(customRules))
	}
	appConfig.LogInfo("[CORAZA] OWASP CRS ruleset extracted to: %s", dataDir)
	appConfig.LogInfo("[CORAZA] WAF is ready to process requests")

	return &CorazaEngine{
		waf:       waf,
		appConfig: appConfig,
		dataDir:   dataDir,
	}, nil
}

func (e *CorazaEngine) ProcessRequest(r *http.Request, clientIP string) (*WAFResult, error) {
	tx := e.waf.NewTransaction()
	defer func() {
		tx.ProcessLogging()
		_ = tx.Close()
	}()

	tx.ProcessConnection(clientIP, 0, "", 0)

	if r.URL.RawQuery != "" {
		queryParams, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil {
			e.appConfig.LogDebug("[CORAZA] Failed to parse query string: %v", err)
		} else {
			for key, values := range queryParams {
				for _, value := range values {
					tx.AddGetRequestArgument(key, value)
				}
			}
		}
	}

	uri := r.URL.Path
	if r.URL.RawQuery != "" {
		decodedQuery, err := url.QueryUnescape(r.URL.RawQuery)
		if err == nil {
			uri = r.URL.Path + "?" + decodedQuery
		} else {
			uri = r.URL.Path + "?" + r.URL.RawQuery
		}
	}
	tx.ProcessURI(uri, r.Method, r.Proto)

	for k, vv := range r.Header {
		for _, v := range vv {
			tx.AddRequestHeader(k, v)
		}
	}

	if it := tx.ProcessRequestHeaders(); it != nil {
		result := buildWAFResult(tx.MatchedRules(), fmt.Sprintf("%d", it.RuleID))
		e.appConfig.LogInfo("[CORAZA] Phase 1 interruption: ruleID=%d anomalyScore=%d matchedRules=%d", it.RuleID, result.AnomalyScore, len(result.MatchedRules))
		return result, nil
	}

	if r.Body != nil && r.ContentLength > 0 {
		body, readErr := io.ReadAll(r.Body)
		r.Body.Close()
		r.Body = io.NopCloser(bytes.NewReader(body))
		if readErr == nil && len(body) > 0 {
			if _, _, err := tx.WriteRequestBody(body); err != nil {
				return nil, fmt.Errorf("failed to write request body: %w", err)
			}
		}
	}

	it, err := tx.ProcessRequestBody()
	if err != nil {
		return nil, fmt.Errorf("failed to process request body: %w", err)
	}
	if it != nil {
		result := buildWAFResult(tx.MatchedRules(), fmt.Sprintf("%d", it.RuleID))
		e.appConfig.LogInfo("[CORAZA] Phase 2 interruption: ruleID=%d anomalyScore=%d matchedRules=%d", it.RuleID, result.AnomalyScore, len(result.MatchedRules))
		return result, nil
	}

	return &WAFResult{}, nil
}

// evaluatorRules are CRS rules that only evaluate/summarize scores, not actual detections.
var evaluatorRules = map[int]bool{
	949110: true, // Inbound Anomaly Score Exceeded
	949111: true, // Inbound Anomaly Score Exceeded (paranoia 2+)
	949112: true, // Inbound Anomaly Score Exceeded (paranoia 3+)
	949113: true, // Inbound Anomaly Score Exceeded (paranoia 4)
	980130: true, // Inbound Anomaly Score (correlation)
}

// buildWAFResult extracts the anomaly score and all detection rules from matched rules.
func buildWAFResult(rules []types.MatchedRule, triggerRule string) *WAFResult {
	result := &WAFResult{
		TriggerRule:  triggerRule,
		MatchedRules: make([]MatchedRuleInfo, 0, len(rules)),
	}

	for _, mr := range rules {
		ruleID := mr.Rule().ID()

		// Extract total anomaly score from evaluator rule message
		if score := parseScoreFromMsg(mr.Message()); score > 0 {
			result.AnomalyScore = score
		}

		// Skip evaluator rules from the matched list
		if evaluatorRules[ruleID] {
			continue
		}

		severity := mr.Rule().Severity().Int()
		// Skip unset severity (-1) or debug/info level rules
		if severity < 0 || severity > 5 {
			continue
		}

		info := MatchedRuleInfo{
			RuleID:   ruleID,
			Severity: severity,
			Message:  mr.Message(),
		}

		// Categorize by rule ID range
		switch {
		case ruleID >= 920000 && ruleID < 921000:
			info.Category = "protocol_enforcement"
		case ruleID >= 921000 && ruleID < 922000:
			info.Category = "protocol_attack"
		case ruleID >= 930000 && ruleID < 931000:
			info.Category = "lfi"
		case ruleID >= 931000 && ruleID < 932000:
			info.Category = "rfi"
		case ruleID >= 932000 && ruleID < 933000:
			info.Category = "rce"
		case ruleID >= 933000 && ruleID < 934000:
			info.Category = "php_injection"
		case ruleID >= 934000 && ruleID < 935000:
			info.Category = "generic_attack"
		case ruleID >= 941000 && ruleID < 942000:
			info.Category = "xss"
		case ruleID >= 942000 && ruleID < 943000:
			info.Category = "sqli"
		case ruleID >= 943000 && ruleID < 944000:
			info.Category = "session_fixation"
		case ruleID >= 944000 && ruleID < 945000:
			info.Category = "java_attack"
		default:
			info.Category = "other"
		}

		result.MatchedRules = append(result.MatchedRules, info)
	}

	// Fallback if no score found from message
	if result.AnomalyScore == 0 && len(result.MatchedRules) > 0 {
		result.AnomalyScore = 1
	}

	return result
}

func parseScoreFromMsg(msg string) int {
	const prefix = "Total Score: "
	idx := strings.Index(msg, prefix)
	if idx == -1 {
		return 0
	}
	score := 0
	for _, c := range msg[idx+len(prefix):] {
		if c >= '0' && c <= '9' {
			score = score*10 + int(c-'0')
		} else {
			break
		}
	}
	return score
}

func extractCRSFiles(src fs.FS, dest string) error {
	return fs.WalkDir(src, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}

		destPath := filepath.Join(dest, path)
		if _, err := os.Stat(destPath); err == nil {
			return nil // File already exists
		}

		data, err := fs.ReadFile(src, path)
		if err != nil {
			return err
		}

		destDir := filepath.Dir(destPath)
		if err := os.MkdirAll(destDir, 0755); err != nil {
			return err
		}

		return os.WriteFile(destPath, data, 0644)
	})
}

func (e *CorazaEngine) Close() error {
	return os.RemoveAll(e.dataDir)
}
