package model

import "time"

type IPReputationEntry struct {
	ID          int       `json:"id" db:"id"`
	EntryType   string    `json:"entry_type" db:"entry_type"`
	Value       string    `json:"value" db:"value"`
	Score       int       `json:"score" db:"score"`
	Category    string    `json:"category" db:"category"`
	Description string    `json:"description" db:"description"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type IPReputationConfig struct {
	MaxmindDCScore   int `json:"maxmind_dc_score"`
	MaxmindASNScore  int `json:"maxmind_asn_score"`
	SpamhausIPScore  int `json:"spamhaus_ip_score"`
	SpamhausASNScore int `json:"spamhaus_asn_score"`
}

func DefaultIPReputationConfig() IPReputationConfig {
	return IPReputationConfig{
		MaxmindDCScore:   15,
		MaxmindASNScore:  15,
		SpamhausIPScore:  50,
		SpamhausASNScore: 50,
	}
}
