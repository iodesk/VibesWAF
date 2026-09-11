package handlers

import (
	"context"
	"fmt"
	"time"

	"github.com/iodesk/VibesWAF/internal/cache"
	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/model"
	"github.com/iodesk/VibesWAF/internal/pipeline"
)

const trustedHistoryKeyPrefix = "th:"
const trustedHistoryCooldownKeyPrefix = "th:cooldown:"
const trustedHistoryTTL = 24 * time.Hour
const trustedHistoryCooldown = time.Second

type trustedHistoryRedis interface {
	IsEnabled() bool
	GetInt(context.Context, string) (int64, error)
	Del(context.Context, string) error
	IncrWithCooldown(context.Context, string, string, time.Duration, time.Duration) (bool, error)
}

type TrustedHistoryScorer struct {
	getConfig func() *model.ScoringConfig
	redis     trustedHistoryRedis
	appCfg    *config.AppConfig
}

func NewTrustedHistoryScorer(getConfig func() *model.ScoringConfig, redis *cache.RedisClient) *TrustedHistoryScorer {
	return newTrustedHistoryScorer(getConfig, redis)
}

func newTrustedHistoryScorer(getConfig func() *model.ScoringConfig, redis trustedHistoryRedis) *TrustedHistoryScorer {
	return &TrustedHistoryScorer{
		getConfig: getConfig,
		redis:     redis,
		appCfg:    config.GetAppConfig(),
	}
}

func (h *TrustedHistoryScorer) Handle(ctx *pipeline.Context) error {
	if ctx.HardDecision {
		return nil
	}

	cfg := h.getConfig()
	if cfg == nil {
		return nil
	}

	threshold := cfg.Trust.TrustedHistoryThreshold
	reduction := cfg.Trust.TrustedHistory
	if threshold <= 0 || reduction == 0 {
		return nil
	}

	if !h.redis.IsEnabled() {
		return nil
	}

	key := trustedHistoryKeyPrefix + ctx.ClientIP
	count, err := h.redis.GetInt(context.Background(), key)
	if err != nil {
		// No history yet for this IP
		ctx.AddTrace(pipeline.StageTrace{
			Stage:  "trusted_history",
			Result: "NEW",
			Reason: "No history yet",
		})
		return nil
	}

	if count >= int64(threshold) {
		ctx.AddScore(pipeline.ScoreCategoryTrust, "trusted_history", reduction)
		h.appCfg.LogDebug("[TRUST] Trusted history: ip=%s count=%d threshold=%d reduction=%d", ctx.ClientIP, count, threshold, reduction)
		ctx.AddTrace(pipeline.StageTrace{
			Stage:  "trusted_history",
			Score:  reduction,
			Reason: fmt.Sprintf("%d clean requests (threshold: %d)", count, threshold),
		})
	} else {
		ctx.AddTrace(pipeline.StageTrace{
			Stage:  "trusted_history",
			Result: "PENDING",
			Reason: fmt.Sprintf("%d / %d clean requests", count, threshold),
		})
	}

	return nil
}

// RecordCleanRequest increments the clean request counter for an IP.
// Called by waf_handler after action=allow.
func (h *TrustedHistoryScorer) RecordCleanRequest(ip string) {
	if !h.redis.IsEnabled() {
		return
	}
	key := trustedHistoryKeyPrefix + ip
	cooldownKey := trustedHistoryCooldownKeyPrefix + ip
	_, _ = h.redis.IncrWithCooldown(context.Background(), key, cooldownKey, trustedHistoryTTL, trustedHistoryCooldown)
}

// ResetHistory resets the trusted history counter for an IP.
// Called when an IP gets blocked or challenged.
func (h *TrustedHistoryScorer) ResetHistory(ip string) {
	if !h.redis.IsEnabled() {
		return
	}
	key := trustedHistoryKeyPrefix + ip
	cooldownKey := trustedHistoryCooldownKeyPrefix + ip
	ctx := context.Background()
	_ = h.redis.Del(ctx, key)
	_ = h.redis.Del(ctx, cooldownKey)
}
