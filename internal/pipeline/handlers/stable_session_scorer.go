package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"github.com/iodesk/VibesWAF/internal/cache"
	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/model"
	"github.com/iodesk/VibesWAF/internal/pipeline"
)

const stableSessionKeyPrefix = "ss:"
const stableSessionTTL = 4 * time.Hour

const storedFieldCount = 4

type StableSessionEvidence struct {
	JA4Match   bool   `json:"ja4_match"`
	JA4HMatch  bool   `json:"ja4h_match"`
	FPMatch    bool   `json:"fp_match"`
	UAMatch    bool   `json:"ua_match"`
	Reduction  int    `json:"reduction"`
}

type StableSessionScorer struct {
	getConfig func() *model.ScoringConfig
	redis     *cache.RedisClient
	appCfg    *config.AppConfig
}

func NewStableSessionScorer(getConfig func() *model.ScoringConfig, redis *cache.RedisClient) *StableSessionScorer {
	return &StableSessionScorer{
		getConfig: getConfig,
		redis:     redis,
		appCfg:    config.GetAppConfig(),
	}
}

func (h *StableSessionScorer) Handle(ctx *pipeline.Context) error {
	if ctx.HardDecision {
		return nil
	}

	cfg := h.getConfig()
	if cfg == nil {
		return nil
	}

	reduction := cfg.Trust.StableSession
	if reduction == 0 {
		return nil
	}

	if !h.redis.IsEnabled() {
		return nil
	}

	ja4 := ctx.GetExtraString("ja4")
	ja4hHeaderHash := ctx.GetExtraString("ja4h_header_hash")
	uaHash := computeUAHash(ctx.Normalized.UA)
	fingerprint := ctx.HTTPFingerprint

	if fingerprint == "" {
		return nil
	}

	key := stableSessionKeyPrefix + ctx.ClientIP
	stored, err := h.redis.Get(context.Background(), key)

	if err != nil || stored == "" {
		newValue := buildStoredValue(ja4, ja4hHeaderHash, fingerprint, uaHash)
		h.redis.Set(context.Background(), key, newValue, stableSessionTTL)
		ctx.AddTrace(pipeline.StageTrace{
			Stage:  "stable_session",
			Result: "NEW",
			Reason: "Fingerprint recorded",
		})
		return nil
	}

	parts := strings.Split(stored, "|")

	var storedJA4, storedJA4H, storedFP, storedUA string
	if len(parts) >= storedFieldCount {
		storedJA4 = parts[0]
		storedJA4H = parts[1]
		storedFP = parts[2]
		storedUA = parts[3]
	} else {
		storedJA4 = ""
		storedJA4H = ""
		storedFP = stored
		storedUA = ""
	}

	ja4Match := storedJA4 == ja4 && ja4 != ""
	ja4hMatch := storedJA4H == ja4hHeaderHash && ja4hHeaderHash != ""
	fpMatch := storedFP == fingerprint
	uaMatch := storedUA != "" && uaHash != "" && storedUA == uaHash

	// Set context keys for trace metadata
	if storedUA != "" {
		ctx.SetExtra("prev_ua_hash", storedUA)
	}
	ctx.SetExtra("ua_match", uaMatch)

	if ja4Match && fpMatch {
		newValue := buildStoredValue(ja4, ja4hHeaderHash, fingerprint, uaHash)
		h.redis.Set(context.Background(), key, newValue, stableSessionTTL)
		ctx.AddScore(pipeline.ScoreCategoryTrust, "stable_session", reduction)
		h.appCfg.LogDebug("[TRUST] Stable session: ip=%s reduction=%d", ctx.ClientIP, reduction)

		evidence := StableSessionEvidence{
			JA4Match:  ja4Match,
			JA4HMatch: ja4hMatch,
			FPMatch:   fpMatch,
			UAMatch:   uaMatch,
			Reduction: reduction,
		}
		evidenceJSON, _ := json.Marshal(evidence)
		ctx.AddTrace(pipeline.StageTrace{
			Stage:    "stable_session",
			Score:    reduction,
			Reason:   "Stable session matched",
			Evidence: json.RawMessage(evidenceJSON),
		})
	} else {
		newValue := buildStoredValue(ja4, ja4hHeaderHash, fingerprint, uaHash)
		h.redis.Set(context.Background(), key, newValue, stableSessionTTL)
		h.appCfg.LogDebug("[TRUST] Stable session mismatch: ip=%s", ctx.ClientIP)

		evidence := StableSessionEvidence{
			JA4Match:  ja4Match,
			JA4HMatch: ja4hMatch,
			FPMatch:   fpMatch,
			UAMatch:   uaMatch,
			Reduction: 0,
		}
		evidenceJSON, _ := json.Marshal(evidence)
		ctx.AddTrace(pipeline.StageTrace{
			Stage:    "stable_session",
			Result:   "CHANGED",
			Reason:   "Fingerprint changed",
			Evidence: json.RawMessage(evidenceJSON),
		})
	}

	return nil
}

func buildStoredValue(ja4, ja4hHeaderHash, fingerprint, uaHash string) string {
	return ja4 + "|" + ja4hHeaderHash + "|" + fingerprint + "|" + uaHash
}

func computeUAHash(ua string) string {
	if ua == "" {
		return ""
	}
	hash := sha256.Sum256([]byte(strings.ToLower(ua)))
	return hex.EncodeToString(hash[:])[:12]
}
