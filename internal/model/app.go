package model

type AppConfig struct {
	AppID  string `json:"app_id"`
	Domain string `json:"domain"`

	UseGlobalRateLimit bool               `json:"use_global_rate_limit"`
	RateLimits         []RateLimitProfile `json:"rate_limits,omitempty"`

	UseGlobalWAF bool        `json:"use_global_waf"`
	WAF          *WAFProfile `json:"waf,omitempty"`

	UseGlobalBot bool        `json:"use_global_bot"`
	Bot          *BotProfile `json:"bot,omitempty"`
}

type RateLimitProfile struct {
	Type         string `json:"type,omitempty"`
	Enabled      bool   `json:"enabled"`
	Duration     int    `json:"duration"`
	Count        int    `json:"count"`
	Action       string `json:"action"`
	ChallengeSec int    `json:"challenge_sec"`
}

type WAFProfile struct {
	ScoreThreshold          int    `json:"score_threshold"`
	OutboundScoreThreshold  int    `json:"outbound_score_threshold,omitempty"`
}

type BotProfile struct {
	EnableChallenge bool   `json:"enable_challenge"`
	ChallengeType   string `json:"challenge_type"`
	ChallengeExpiry int    `json:"challenge_expiry"`
	ChallengeWait   int    `json:"challenge_wait"`
}