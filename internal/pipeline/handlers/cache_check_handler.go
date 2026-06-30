package handlers

import (
	"encoding/json"

	"github.com/vibeswaf/waf/internal/cache"
	"github.com/vibeswaf/waf/internal/config"
	"github.com/vibeswaf/waf/internal/pipeline"
)

type CacheEvidence struct {
	Action string `json:"action"`
	Source string `json:"source"`
	Reason string `json:"reason"`
}

type CacheCheckHandler struct {
	decisionCache *cache.DecisionCache
	appCfg        *config.AppConfig
}

func NewCacheCheckHandler(decisionCache *cache.DecisionCache) *CacheCheckHandler {
	return &CacheCheckHandler{
		decisionCache: decisionCache,
		appCfg:        config.GetAppConfig(),
	}
}

func (h *CacheCheckHandler) Handle(ctx *pipeline.Context) error {
	if ctx.IPRuleTerminal {
		ctx.AddTrace(pipeline.StageTrace{Stage: "decision_cache", Result: "SKIP"})
		return nil
	}
	if ctx.ChallengePassed {
		ctx.AddTrace(pipeline.StageTrace{Stage: "decision_cache", Result: "SKIP"})
		return nil
	}

	cached := h.decisionCache.Get(ctx)
	if cached == nil {
		ctx.AddTrace(pipeline.StageTrace{Stage: "decision_cache", Result: "MISS"})
		return nil
	}

	ctx.AddDecision(pipeline.NewDecision(cached.Action, cached.Source, cached.Reason))
	ctx.CacheHit = true
	h.appCfg.LogDebug("[CACHE] HIT action=%s ip=%s", cached.Action, ctx.ClientIP)

	evidence := CacheEvidence{
		Action: cached.Action,
		Source: cached.Source,
		Reason: cached.Reason,
	}
	evidenceJSON, _ := json.Marshal(evidence)
	ctx.AddTrace(pipeline.StageTrace{
		Stage:    "decision_cache",
		Result:   "HIT",
		Reason:   cached.Reason,
		Evidence: json.RawMessage(evidenceJSON),
	})
	return nil
}
