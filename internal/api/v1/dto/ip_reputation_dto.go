package dto

type IPReputationEntryResponse struct {
	ID          int    `json:"id"`
	EntryType   string `json:"entry_type"`
	Value       string `json:"value"`
	Score       int    `json:"score"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type CreateIPReputationEntryRequest struct {
	EntryType           string   `json:"entry_type"`
	Value               string   `json:"value"`
	Values              []string `json:"values"`
	Score               int      `json:"score"`
	Category            string   `json:"category"`
	Description         string   `json:"description"`
	Enabled             bool     `json:"enabled"`
	AutoDetectProvider  bool     `json:"auto_detect_provider"`
}

type UpdateIPReputationEntryRequest struct {
	EntryType   string `json:"entry_type"`
	Value       string `json:"value"`
	Score       int    `json:"score"`
	Category    string `json:"category"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}

type IPReputationConfigResponse struct {
	MaxmindDCScore   int `json:"maxmind_dc_score"`
	MaxmindASNScore  int `json:"maxmind_asn_score"`
	SpamhausIPScore  int `json:"spamhaus_ip_score"`
	SpamhausASNScore int `json:"spamhaus_asn_score"`
}

type UpdateIPReputationConfigRequest struct {
	MaxmindDCScore   int `json:"maxmind_dc_score"`
	MaxmindASNScore  int `json:"maxmind_asn_score"`
	SpamhausIPScore  int `json:"spamhaus_ip_score"`
	SpamhausASNScore int `json:"spamhaus_asn_score"`
}
