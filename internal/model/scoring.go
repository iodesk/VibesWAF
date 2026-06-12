package model

import "encoding/json"

type ScoringConfig struct {
	Thresholds ScoringThresholds      `json:"thresholds"`
	Weights    ScoringWeights         `json:"weights"`
	Trust      TrustReductionConfig   `json:"trust"`
}

type ScoringThresholds struct {
	Block     int `json:"block"`
	Challenge int `json:"challenge"`
}

type ScoringWeights struct {
	IPReputation    CategoryWeight `json:"ip_reputation"`
	BotDetection    CategoryWeight `json:"bot_detection"`
	WAFAnomaly      CategoryWeight `json:"waf_anomaly"`
	ProtocolAnomaly CategoryWeight `json:"protocol_anomaly"`
}

type CategoryWeight struct {
	Enabled   bool `json:"enabled"`
	MaxScore  int  `json:"max_score"`
	Multiplier float64 `json:"multiplier"`
}

type TrustReductionConfig struct {
	TrustedHistory          int `json:"trusted_history"`
	TrustedHistoryThreshold int `json:"trusted_history_threshold"`
	StableSession           int `json:"stable_session"`
	GoodBot                 int `json:"good_bot"`
}

func DefaultScoringConfig() ScoringConfig {
	return ScoringConfig{
		Thresholds: ScoringThresholds{
			Block:     70,
			Challenge: 35,
		},
		Weights: ScoringWeights{
			IPReputation: CategoryWeight{
				Enabled:    true,
				MaxScore:   30,
				Multiplier: 1.0,
			},
			BotDetection: CategoryWeight{
				Enabled:    true,
				MaxScore:   35,
				Multiplier: 1.0,
			},
			WAFAnomaly: CategoryWeight{
				Enabled:    true,
				MaxScore:   40,
				Multiplier: 1.5,
			},
			ProtocolAnomaly: CategoryWeight{
				Enabled:    true,
				MaxScore:   35,
				Multiplier: 1.0,
			},
		},
		Trust: TrustReductionConfig{
			TrustedHistory:          -4,
			TrustedHistoryThreshold: 50,
			StableSession:           -2,
			GoodBot:                 -5,
		},
	}
}

func (c ScoringConfig) Marshal() (json.RawMessage, error) {
	return json.Marshal(c)
}
