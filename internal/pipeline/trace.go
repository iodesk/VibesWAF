package pipeline

import "encoding/json"

type StageTrace struct {
	Stage      string  `json:"stage"`
	Result     string  `json:"result,omitempty"`
	Score      int     `json:"score,omitempty"`
	Multiplier float64 `json:"multiplier,omitempty"`
	FinalScore int     `json:"final_score,omitempty"`
	Reason     string  `json:"reason,omitempty"`
	Evidence   string  `json:"evidence,omitempty"`
	RuleID     string  `json:"rule_id,omitempty"`
}

type PipelineTrace struct {
	Phase    string       `json:"phase"`
	Decision string       `json:"decision"`
	Score    int          `json:"score,omitempty"`
	Stages   []StageTrace `json:"stages"`
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
