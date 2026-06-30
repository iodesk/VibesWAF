package handlers

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/vibeswaf/waf/internal/cache"
	"github.com/vibeswaf/waf/internal/config"
	"github.com/vibeswaf/waf/internal/model"
	"github.com/vibeswaf/waf/internal/pipeline"
)

const stableSessionKeyPrefix = "ss:"
const stableSessionTTL = 4 * time.Hour

const storedFieldCount = 3

type StableSessionEvidence struct {
	JA4Match   bool   `json:"ja4_match"`
	JA4HMatch  bool   `json:"ja4h_match"`
	FPMatch    bool   `json:"fp_match"`
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
	ja4hUAHash := ctx.GetExtraString("ja4h_ua_hash")
	fingerprint := ctx.HTTPFingerprint

	if fingerprint == "" {
		return nil
	}

	key := stableSessionKeyPrefix + ctx.ClientIP
	stored, err := h.redis.Get(context.Background(), key)

	if err != nil || stored == "" {
		newValue := buildStoredValue(ja4, ja4hUAHash, fingerprint)
		h.redis.Set(context.Background(), key, newValue, stableSessionTTL)
		ctx.AddTrace(pipeline.StageTrace{
			Stage:  "stable_session",
			Result: "NEW",
			Reason: "Fingerprint recorded",
		})
		return nil
	}

	parts := strings.Split(stored, "|")

	var storedJA4, storedJA4H, storedFP string
	if len(parts) >= storedFieldCount {
		storedJA4 = parts[0]
		storedJA4H = parts[1]
		storedFP = parts[2]
	} else {
		storedJA4 = ""
		storedJA4H = ""
		storedFP = stored
	}

	ja4Match := storedJA4 == ja4 && ja4 != ""
	ja4hMatch := storedJA4H == ja4hUAHash && ja4hUAHash != ""
	fpMatch := storedFP == fingerprint

	if ja4Match && fpMatch {
		newValue := buildStoredValue(ja4, ja4hUAHash, fingerprint)
		h.redis.Set(context.Background(), key, newValue, stableSessionTTL)
		ctx.AddScore(pipeline.ScoreCategoryTrust, "stable_session", reduction)
		h.appCfg.LogDebug("[TRUST] Stable session: ip=%s reduction=%d", ctx.ClientIP, reduction)

		evidence := StableSessionEvidence{
			JA4Match:  ja4Match,
			JA4HMatch: ja4hMatch,
			FPMatch:   fpMatch,
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
		newValue := buildStoredValue(ja4, ja4hUAHash, fingerprint)
		h.redis.Set(context.Background(), key, newValue, stableSessionTTL)
		h.appCfg.LogDebug("[TRUST] Stable session mismatch: ip=%s", ctx.ClientIP)

		evidence := StableSessionEvidence{
			JA4Match:  ja4Match,
			JA4HMatch: ja4hMatch,
			FPMatch:   fpMatch,
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

func buildStoredValue(ja4, ja4hUAHash, fingerprint string) string {
	return ja4 + "|" + ja4hUAHash + "|" + fingerprint
}
