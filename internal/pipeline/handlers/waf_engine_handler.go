package handlers

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/vibeswaf/waf/internal/config"
	"github.com/vibeswaf/waf/internal/pipeline"
	"github.com/vibeswaf/waf/internal/service"
	"github.com/vibeswaf/waf/internal/waf"
)

type WAFMatchedRule struct {
	ID       int    `json:"id"`
	Category string `json:"category"`
	Severity int    `json:"severity"`
}

type WAFEvidence struct {
	AnomalyScore  int            `json:"anomaly_score"`
	MatchedRules  []WAFMatchedRule `json:"matched_rules"`
	TriggerRule   string         `json:"trigger_rule,omitempty"`
}

type WAFEngineHandler struct {
	wafService *service.WAFService
	appCfg     *config.AppConfig
}

func NewWAFEngineHandler(wafService *service.WAFService) *WAFEngineHandler {
	return &WAFEngineHandler{
		wafService: wafService,
		appCfg:     config.GetAppConfig(),
	}
}

func (h *WAFEngineHandler) Handle(ctx *pipeline.Context) error {
	if ctx.IPRuleTerminal {
		h.appCfg.LogDebug("[WAF_ENGINE] Skipped: IP rule is terminal")
		ctx.AddTrace(pipeline.StageTrace{Stage: "waf_anomaly", Result: "SKIP"})
		return nil
	}

	if ctx.ShouldSkipModule("waf") {
		h.appCfg.LogDebug("[WAF_ENGINE] Skipped: ShouldSkipModule")
		ctx.AddTrace(pipeline.StageTrace{Stage: "waf_anomaly", Result: "SKIP"})
		return nil
	}

	if ctx.IsPhaseSkipped("waf") {
		h.appCfg.LogDebug("[WAF_ENGINE] Skipped: phase marked as skipped")
		ctx.AddTrace(pipeline.StageTrace{Stage: "waf_anomaly", Result: "SKIP"})
		return nil
	}

	result := h.wafService.DetectOnly(ctx)

	ctx.WAFStatus = result.AnomalyScore
	ctx.SetExtra("waf_rule_id", result.TriggerRule)
	ctx.SetExtra("waf_matched_rules", result.MatchedRules)

	if result.AnomalyScore > 0 {
		ruleID := h.buildRuleID(result)
		reason := h.buildReason(result)
		evidence := h.buildEvidence(result)

		ctx.AddScore(pipeline.ScoreCategoryWAFAnomaly, ruleID, result.AnomalyScore)
		h.appCfg.LogDebug("[WAF_ENGINE] Contributed score=%d to risk scoring (%s)", result.AnomalyScore, reason)

		evidenceJSON, _ := json.Marshal(evidence)
		ctx.AddTrace(pipeline.StageTrace{
			Stage:    "waf_anomaly",
			Score:    result.AnomalyScore,
			RuleID:   ruleID,
			Reason:   reason,
			Evidence: json.RawMessage(evidenceJSON),
		})
	} else {
		ctx.AddTrace(pipeline.StageTrace{Stage: "waf_anomaly", Score: 0})
	}

	return nil
}

func (h *WAFEngineHandler) buildRuleID(result *waf.WAFResult) string {
	if len(result.MatchedRules) == 0 {
		return "owasp_crs:" + result.TriggerRule
	}
	ids := make([]string, 0, len(result.MatchedRules))
	for _, mr := range result.MatchedRules {
		ids = append(ids, fmt.Sprintf("%d", mr.RuleID))
	}
	return strings.Join(ids, ",")
}

func (h *WAFEngineHandler) buildReason(result *waf.WAFResult) string {
	if len(result.MatchedRules) == 0 {
		return "OWASP CRS match"
	}
	categories := make(map[string]int)
	for _, mr := range result.MatchedRules {
		categories[mr.Category]++
	}
	parts := make([]string, 0, len(categories))
	for cat, count := range categories {
		parts = append(parts, fmt.Sprintf("%s(%d)", cat, count))
	}
	return strings.Join(parts, ",")
}

func (h *WAFEngineHandler) buildEvidence(result *waf.WAFResult) WAFEvidence {
	evidence := WAFEvidence{
		AnomalyScore: result.AnomalyScore,
		MatchedRules: make([]WAFMatchedRule, 0),
		TriggerRule:  result.TriggerRule,
	}
	for _, mr := range result.MatchedRules {
		evidence.MatchedRules = append(evidence.MatchedRules, WAFMatchedRule{
			ID:       mr.RuleID,
			Category: mr.Category,
			Severity: mr.Severity,
		})
	}
	return evidence
}
