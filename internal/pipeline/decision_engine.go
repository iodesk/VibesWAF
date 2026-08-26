package pipeline

import (
	"fmt"
	"strings"

	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/model"
)

type DecisionEngine struct {
	getConfig func() *model.ScoringConfig
	appCfg    *config.AppConfig
}

func NewDecisionEngine(getConfig func() *model.ScoringConfig) *DecisionEngine {
	return &DecisionEngine{
		getConfig: getConfig,
		appCfg:    config.GetAppConfig(),
	}
}

func (e *DecisionEngine) Handle(ctx *Context) error {
	// If a hard decision was already made in Phase 1, respect it
	if ctx.HardDecision {
		return nil
	}

	// If Phase 1 already set an action (e.g. challenge_passed → allow), keep it
	if ctx.Action == "block" || ctx.Action == "challenge" {
		return nil
	}

	cfg := e.getConfig()
	if cfg == nil {
		return nil
	}

	score := ctx.GetRiskTotal()
	thresholds := cfg.Thresholds

	var action string
	switch {
	case score >= thresholds.Block:
		action = "block"
	case score >= thresholds.Challenge:
		action = "challenge"
	default:
		action = ""
	}

	if action == "" {
		e.appCfg.LogDebug("[DECISION_ENGINE] score=%d → allow", score)
		return nil
	}

	reason := e.buildReason(ctx, score)
	e.appCfg.LogInfo("[DECISION_ENGINE] score=%d → %s (%s)", score, action, reason)

	decision := NewDecision(action, "scoring_engine", reason)
	ctx.AddDecision(decision)

	return nil
}

func (e *DecisionEngine) buildReason(ctx *Context, score int) string {
	if ctx.RiskScore == nil {
		return fmt.Sprintf("risk_score:%d", score)
	}

	parts := make([]string, 0, 6)
	parts = append(parts, fmt.Sprintf("total:%d", score))

	bc := ctx.RiskScore.ByCategory
	if bc.IPReputation != 0 {
		parts = append(parts, fmt.Sprintf("ip_reputation:%d", bc.IPReputation))
	}
	if bc.BotDetection != 0 {
		parts = append(parts, fmt.Sprintf("bot_detection:%d", bc.BotDetection))
	}
	if bc.WAFAnomaly != 0 {
		parts = append(parts, fmt.Sprintf("waf_anomaly:%d", bc.WAFAnomaly))
	}
	if bc.ProtocolAnomaly != 0 {
		parts = append(parts, fmt.Sprintf("protocol_anomaly:%d", bc.ProtocolAnomaly))
	}
	if bc.Trust != 0 {
		parts = append(parts, fmt.Sprintf("trust:%d", bc.Trust))
	}

	return strings.Join(parts, "|")
}
