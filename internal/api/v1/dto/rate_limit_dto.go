package dto


type RateLimitConfig struct {
	Enabled      bool   `json:"enabled"`
	Duration     int    `json:"duration"`
	Count        int    `json:"count"`
	Action       string `json:"action"`
	ChallengeSec int    `json:"challenge_sec"`
}


type RateLimitResponse struct {
	Basic  RateLimitConfig `json:"basic"`
	Attack RateLimitConfig `json:"attack"`
	Error  RateLimitConfig `json:"error"`
}


type RateLimitUpdateRequest struct {
	Basic  *RateLimitConfig `json:"basic,omitempty"`
	Attack *RateLimitConfig `json:"attack,omitempty"`
	Error  *RateLimitConfig `json:"error,omitempty"`
}
