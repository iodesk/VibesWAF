package pipeline

import "encoding/json"

type StageTrace struct {
	Stage      string          `json:"stage"`
	Result     string          `json:"result,omitempty"`
	Score      int             `json:"score,omitempty"`
	Multiplier float64         `json:"multiplier,omitempty"`
	FinalScore int             `json:"final_score,omitempty"`
	Reason     string          `json:"reason,omitempty"`
	Evidence   any             `json:"evidence,omitempty"`
	RuleID     string          `json:"rule_id,omitempty"`
	Details    json.RawMessage `json:"details,omitempty"`
}

type RequestMetadata struct {
	IP              string `json:"ip"`
	Method          string `json:"method"`
	Path            string `json:"path"`
	Host            string `json:"host"`
	UserAgent       string `json:"user_agent,omitempty"`
	JA4             string `json:"ja4,omitempty"`
	JA4H            string `json:"ja4h,omitempty"`
	JA4H_UA_Hash    string `json:"ja4h_ua_hash,omitempty"`
	ActualUA_Hash   string `json:"actual_ua_hash,omitempty"`
	UA_Match        bool   `json:"ua_match,omitempty"`
	HTTPFingerprint string `json:"http_fingerprint,omitempty"`
}

type PipelineTrace struct {
	Phase    string          `json:"phase"`
	Decision string          `json:"decision"`
	Score    int             `json:"score,omitempty"`
	Request  *RequestMetadata `json:"request,omitempty"`
	Stages   []StageTrace    `json:"stages"`
}

func NewPipelineTrace() *PipelineTrace {
	return &PipelineTrace{
		Stages: make([]StageTrace, 0, 12),
	}
}

func (ctx *Context) AddTrace(stage StageTrace) {
	if ctx.Trace == nil {
		ctx.Trace = NewPipelineTrace()
	}
	ctx.Trace.Stages = append(ctx.Trace.Stages, stage)
}

func (ctx *Context) SerializeTrace() string {
	if ctx.Trace == nil {
		return ""
	}
	b, err := json.Marshal(ctx.Trace)
	if err != nil {
		return ""
	}
	return string(b)
}
