package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/yourapp/waf/internal/config"
	"github.com/yourapp/waf/internal/pipeline"
	"github.com/yourapp/waf/internal/service"
)

type ChallengeValidator struct {
	botService *service.BotDetectionService
	appCfg     *config.AppConfig
}

func NewChallengeValidator(botService *service.BotDetectionService) *ChallengeValidator {
	return &ChallengeValidator{
		botService: botService,
		appCfg:     config.GetAppConfig(),
	}
}

func (h *ChallengeValidator) Handle(ctx *pipeline.Context) error {
	h.appCfg.LogDebug("[VALIDATOR] Checking cookie for IP=%s", ctx.ClientIP)

	cookie, err := ctx.Request.Cookie("ok")
	if err != nil || cookie.Value == "" {
		h.appCfg.LogDebug("[VALIDATOR] No valid cookie found")
		ctx.AddTrace(pipeline.StageTrace{Stage: "challenge_validator", Result: "NO_COOKIE"})
		return nil
	}

	h.appCfg.LogDebug("[VALIDATOR] Cookie found: value=%s", cookie.Value)

	clientIP := h.extractClientIP(ctx.Request)

	trustLevel, ok := h.verifyCookie(cookie.Value, clientIP, ctx.Request.UserAgent())
	if ok {
		h.appCfg.LogInfo("[VALIDATOR] Valid cookie for IP=%s trust_level=%d", ctx.ClientIP, trustLevel)

		ctx.ChallengePassed = true
		ctx.TrustLevel = trustLevel

		ctx.Action = ""
		ctx.Reason = ""
		ctx.AddTrace(pipeline.StageTrace{Stage: "challenge_validator", Result: fmt.Sprintf("VERIFIED_L%d", trustLevel)})
	} else {
		h.appCfg.LogDebug("[VALIDATOR] Invalid cookie for IP=%s", ctx.ClientIP)
		ctx.AddTrace(pipeline.StageTrace{Stage: "challenge_validator", Result: "INVALID_COOKIE"})
	}

	return nil
}

func (h *ChallengeValidator) extractClientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		ip := strings.SplitN(fwd, ",", 2)[0]
		return strings.TrimSpace(ip)
	}
	return r.RemoteAddr
}

func (h *ChallengeValidator) verifyCookie(cookieValue, clientIP, userAgent string) (int, bool) {
	parts := strings.Split(cookieValue, ".")

	// Support both old format (sig.ts) and new format (sig.ts.level)
	if len(parts) < 2 || len(parts) > 3 {
		return 0, false
	}

	signature := parts[0]
	timestampStr := parts[1]

	timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return 0, false
	}

	var trustLevel int
	if len(parts) == 3 {
		tl, err := strconv.Atoi(parts[2])
		if err != nil || tl < 0 || tl > 3 {
			return 0, false
		}
		trustLevel = tl
	}

	botCfg := h.botService.GetConfig()
	maxAge := int64(botCfg.ChallengeDuration)

	if time.Now().Unix()-timestamp > maxAge {
		h.appCfg.LogDebug("[VALIDATOR] Cookie expired")
		return 0, false
	}

	secret := os.Getenv("WAF_SECRET")
	if secret == "" {
		secret = "fallback_secret"
	}

	// Verify HMAC with trust_level included in payload
	var payload string
	if len(parts) == 3 {
		payload = fmt.Sprintf("%s:%s:%d:%d", clientIP, userAgent, timestamp, trustLevel)
	} else {
		// Backward compatible: old cookie without trust_level
		payload = fmt.Sprintf("%s:%s:%d", clientIP, userAgent, timestamp)
	}

	hm := hmac.New(sha256.New, []byte(secret))
	hm.Write([]byte(payload))
	expectedSignature := hex.EncodeToString(hm.Sum(nil))[:32]

	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		return 0, false
	}

	return trustLevel, true
}
