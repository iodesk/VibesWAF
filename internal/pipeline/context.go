package pipeline

import "net/http"

type Context struct {
	Request *http.Request
	Writer  http.ResponseWriter

	ClientIP string
	Key      string

	Action string
	Reason string

	CurrentDecision Decision
	SkipPhases      map[string]bool

	SkipModules map[string]bool

	// --- Typed request signals (single source of truth) ---
	// These replace the former Metadata map for well-known, hot-path values,
	// eliminating per-request map allocation, boxing, and type assertions.

	// Geo / network (set once by the WAF handler from MaxMind).
	Country      string
	ASN          uint
	ASNOrg       string
	IsDatacenter bool

	// Routing.
	AppID string

	// Request fingerprint (set by the WAF handler).
	HTTPFingerprint string

	// Phase 1 flags.
	IPRuleTerminal  bool
	ChallengePassed bool
	TrustLevel      int

	// Scoring signals.
	WAFStatus int

	// Bot detection signals (set by bot detection, read by scorer).
	GeoLangMismatch   bool
	UnknownBrowserBot bool
	RepeatNoCookie    bool
	BurstRate         bool
	RegularInterval   bool
	IsKnownBot        bool
	BotType           string

	// Observability.
	CacheHit           bool
	PhaseExit          string
	PipelineDurationUS int64

	// Extra holds dynamic, write-mostly values that have no fixed schema
	// (matched rule details, JA4, WAF rule ids). Allocated lazily on first
	// write so the common path stays allocation-free.
	Extra map[string]interface{}

	// Normalized holds pre-computed, canonical request values.
	// Populated once by the pipeline before any handler runs.
	// All handlers and rule evaluators MUST read from here, not from Request directly.
	Normalized NormalizedRequest

	// RiskScore accumulates adaptive scoring from Phase 2 handlers.
	// Each scoring handler contributes points; the decision engine
	// evaluates the total at the end of Phase 2.
	RiskScore *RiskScore

	// HardDecision is set by Phase 1 handlers when a deterministic
	// early-exit decision is made (known bad IP, confirmed attack).
	// When set, Phase 2 scoring is skipped entirely.
	HardDecision bool

	// Trace records per-stage pipeline execution for audit and debugging.
	Trace *PipelineTrace
}

// SetExtra stores a dynamic value, allocating the Extra map on first use.
func (ctx *Context) SetExtra(key string, value interface{}) {
	if ctx.Extra == nil {
		ctx.Extra = make(map[string]interface{}, 8)
	}
	ctx.Extra[key] = value
}

// GetExtra returns a dynamic value and whether it was present.
func (ctx *Context) GetExtra(key string) (interface{}, bool) {
	if ctx.Extra == nil {
		return nil, false
	}
	v, ok := ctx.Extra[key]
	return v, ok
}

// GetMetadata projects the typed signals (plus Extra) into a map for consumers
// that require dynamic key access, principally the custom rule engine. It is
// only invoked when a rule references a metadata-backed field, so the common
// request path never builds this map.
func (ctx *Context) GetMetadata() map[string]interface{} {
	m := make(map[string]interface{}, len(ctx.Extra)+6)
	for k, v := range ctx.Extra {
		m[k] = v
	}
	if ctx.Country != "" {
		m["country"] = ctx.Country
	}
	if ctx.ASN != 0 {
		m["asn"] = ctx.ASN
	}
	if ctx.ASNOrg != "" {
		m["asn_org"] = ctx.ASNOrg
	}
	m["is_datacenter"] = ctx.IsDatacenter
	if ctx.AppID != "" {
		m["app_id"] = ctx.AppID
	}
	return m
}

func (ctx *Context) AddDecision(decision Decision) {
	if decision.Action == "skip" {
		if ctx.SkipPhases == nil {
			ctx.SkipPhases = make(map[string]bool)
		}
		for _, phase := range decision.SkipPhases {
			ctx.SkipPhases[phase] = true
		}
		if len(decision.SkipPhases) == 0 && decision.Metadata != nil {
			if modules, ok := decision.Metadata["skip_modules"].([]string); ok {
				ctx.AddSkipModules(modules)
			}
		}
		return
	}

	ctx.CurrentDecision = ResolveDecision(ctx.CurrentDecision, decision)

	ctx.Action = ctx.CurrentDecision.Action
	ctx.Reason = ctx.CurrentDecision.Reason
}

func (ctx *Context) IsPhaseSkipped(phase string) bool {
	if ctx.SkipPhases == nil {
		return false
	}
	return ctx.SkipPhases[phase]
}

func (ctx *Context) ShouldSkipModule(moduleName string) bool {
	if ctx.SkipModules == nil {
		return false
	}
	return ctx.SkipModules[moduleName]
}

func (ctx *Context) AddSkipModules(modules []string) {
	if ctx.SkipModules == nil {
		ctx.SkipModules = make(map[string]bool)
	}
	for _, mod := range modules {
		ctx.SkipModules[mod] = true
	}
}

func (ctx *Context) AddScore(category ScoreCategory, rule string, score int) {
	if ctx.RiskScore == nil {
		ctx.RiskScore = NewRiskScore()
	}
	ctx.RiskScore.Add(category, rule, score)
}

func (ctx *Context) GetRiskTotal() int {
	if ctx.RiskScore == nil {
		return 0
	}
	return ctx.RiskScore.Total
}
