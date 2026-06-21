package model

import (
	"encoding/json"
	"time"
)


type RateLimitProfile struct {
	Type         string `json:"type,omitempty"`
	Enabled      bool   `json:"enabled"`
	Duration     int    `json:"duration"`
	Count        int    `json:"count"`
	Action       string `json:"action"`
	ChallengeSec int    `json:"challenge_sec"`
}

type Setting struct {
	Key       string          `db:"key"`
	Value     json.RawMessage `db:"value"`
	UpdatedAt time.Time       `db:"updated_at"`
}

type ChallengeConfig struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Footer      string `json:"footer"`
	CustomHTML  string `json:"custom_html"`
	ShowRayID   bool   `json:"show_ray_id"`
}

type ChallengeTrustLevel struct {
	Level0Max float64 `json:"level0_max"`
	Level1Max float64 `json:"level1_max"`
	Level2Max float64 `json:"level2_max"`
	Reductions [4]int `json:"reductions"`
}

type BotConfig struct {
	Threshold         int                `json:"threshold"`
	Action            string             `json:"action"`
	ChallengeDuration int                `json:"challenge_duration"`
	ChallengeWait     int                `json:"challenge_wait"`
	Rules             map[string]int     `json:"rules"`
	Challenge         ChallengeConfig    `json:"challenge"`
	TrustLevels       ChallengeTrustLevel `json:"trust_levels"`
}

func DefaultBotConfig() BotConfig {
	return BotConfig{
		Threshold:         20,
		Action:            "challenge",
		ChallengeDuration: 3700,
		ChallengeWait:     30,
		Rules: map[string]int{
			"missing_user_agent":         10,
			"short_user_agent":           8,
			"missing_accept":             8,
			"wildcard_accept_browser_ua": 5,
			"missing_accept_language":    8,
			"missing_accept_encoding":    8,
			"missing_sec_fetch":          15,
			"incomplete_sec_fetch":       8,
			"no_browser_indicators":      8,
			"chromium_missing_sec_ch_ua": 15,
			"chromium_missing_sec_fetch": 15,
			"firefox_has_sec_ch_ua":      8,
			"no_gzip_or_br":              3,
			"geo_lang_mismatch":          8,
			"repeat_no_cookie":           10,
			"burst_rate":                 8,
			"regular_interval":           6,
			"unknown_browser_bot":        27,
			"headless_browser":           25,
		},
		Challenge: ChallengeConfig{
			Title:       "Verifying your connection...",
			Description: "Please wait while we verify your request. This process is automatic.",
			Footer:      "Protected by Wafer WAF",
			ShowRayID:   true,
		},
		TrustLevels: ChallengeTrustLevel{
			Level0Max:  0.40,
			Level1Max:  0.60,
			Level2Max:  0.80,
			Reductions: [4]int{0, -5, -10, -15},
		},
	}
}

type WAFConfig struct {
	ParanoiaLevel            int      `json:"paranoia_level"`
	AnomalyThreshold         int      `json:"anomaly_threshold"`
	OutboundAnomalyThreshold int      `json:"outbound_anomaly_threshold"`
	AllowedMethods           []string `json:"allowed_methods"`
	DisabledRules            []int    `json:"disabled_rules"`
	CustomRules              string   `json:"custom_rules"`
}

func DefaultWAFConfig() WAFConfig {
	return WAFConfig{
		ParanoiaLevel:            1,
		AnomalyThreshold:         5,
		OutboundAnomalyThreshold: 4,
		AllowedMethods:           []string{"GET", "HEAD", "POST", "OPTIONS"},
		DisabledRules:            []int{920274, 942421}, // Cloudflare compatibility
		CustomRules:              "",                    // Empty by default
	}
}

type RateLimitConfig struct {
	Basic  RateLimitProfile `json:"basic"`
	Attack RateLimitProfile `json:"attack"`
	Error  RateLimitProfile `json:"error"`
}

func DefaultRateLimitConfig() RateLimitConfig {
	return RateLimitConfig{
		Basic: RateLimitProfile{
			Enabled:      true,
			Duration:     30,
			Count:        50,
			Action:       "block",
			ChallengeSec: 300,
		},
		Attack: RateLimitProfile{
			Enabled:      true,
			Duration:     60,
			Count:        40,
			Action:       "block",
			ChallengeSec: 300,
		},
		Error: RateLimitProfile{
			Enabled:      false,
			Duration:     60,
			Count:        15,
			Action:       "challenge",
			ChallengeSec: 300,
		},
	}
}

type ProtocolAnomalyConfig struct {
	Rules map[string]int `json:"rules"`
}

func DefaultProtocolAnomalyConfig() ProtocolAnomalyConfig {
	return ProtocolAnomalyConfig{
		Rules: map[string]int{
			"http2_connection_header":      8,
			"content_type_no_body":         5,
			"accept_path_mismatch":         5,
			"sec_fetch_dest_mismatch":      6,
			"upgrade_non_navigate":         4,
			"te_cl_conflict":               10,
			"multiple_host_headers":        10,
			"malformed_challenge_cookie":   8,
			"future_cookie_timestamp":      8,
			"excessive_cookies_no_referer": 5,
			"ja4_old_tls_browser_ua":       15,
			"browser_ua_http10":            15,
			"browser_ua_ja4_empty":         4,
			"bot_ua_browser_ja4":           15,
			"browser_ua_simple_ja4":        15,
		},
	}
}
