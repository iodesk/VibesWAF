package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/model"
	"github.com/iodesk/VibesWAF/internal/pipeline"
	"github.com/iodesk/VibesWAF/internal/service"
)

// challengeSignatureHexLen is the length of a full HMAC-SHA256 signature.
// Shorter signatures are rejected: accepting a truncated digest would allow a
// downgrade attack against the cookie verification.
const challengeSignatureHexLen = 64

// challengeClockSkew tolerates a small clock difference between the WAF host
// and the client when validating the cookie timestamp.
const challengeClockSkew = 60

type botConfigProvider interface {
	GetConfig() model.BotConfig
}

type ChallengeValidator struct {
	botService botConfigProvider
	appCfg     *config.AppConfig
	secret     string
	hmacPool   sync.Pool
}

func NewChallengeValidator(botService *service.BotDetectionService) *ChallengeValidator {
	return newChallengeValidator(botService, os.Getenv("WAF_SECRET"))
}

func newChallengeValidator(botService botConfigProvider, secret string) *ChallengeValidator {
	if secret == "" {
		secret = "fallback_secret"
	}
	secretBytes := []byte(secret)
	return &ChallengeValidator{
		botService: botService,
		appCfg:     config.GetAppConfig(),
		secret:     secret,
		hmacPool: sync.Pool{
			New: func() interface{} {
				return hmac.New(sha256.New, secretBytes)
			},
		},
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

	clientIP := ctx.ClientIP

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

func (h *ChallengeValidator) verifyCookie(cookieValue, clientIP, userAgent string) (int, bool) {
	parts := strings.Split(cookieValue, ".")

	// Only the current format (sig.ts.level) is accepted. The legacy
	// two-part cookie is refused so a downgrade cannot bypass the trust level.
	if len(parts) != 3 {
		return 0, false
	}

	signature := parts[0]
	timestampStr := parts[1]

	if len(signature) != challengeSignatureHexLen {
		return 0, false
	}

	timestamp, err := strconv.ParseInt(timestampStr, 10, 64)
	if err != nil {
		return 0, false
	}

	trustLevel, err := strconv.Atoi(parts[2])
	if err != nil || trustLevel < 0 || trustLevel > 3 {
		return 0, false
	}

	botCfg := h.botService.GetConfig()
	maxAge := int64(botCfg.ChallengeDuration)

	now := time.Now().Unix()
	if now-timestamp > maxAge {
		h.appCfg.LogDebug("[VALIDATOR] Cookie expired")
		return 0, false
	}
	if timestamp-now > challengeClockSkew {
		h.appCfg.LogDebug("[VALIDATOR] Cookie timestamp is in the future")
		return 0, false
	}

	// Verify HMAC with trust_level included in payload
	payload := fmt.Sprintf("%s:%s:%d:%d", clientIP, userAgent, timestamp, trustLevel)

	hm := h.hmacPool.Get().(hash.Hash)
	hm.Reset()
	hm.Write([]byte(payload))
	expectedFull := hex.EncodeToString(hm.Sum(nil))
	h.hmacPool.Put(hm)

	if !hmac.Equal([]byte(signature), []byte(expectedFull)) {
		return 0, false
	}

	return trustLevel, true
}
