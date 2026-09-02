package dto

type BotPatternResponse struct {
	ID          int    `json:"id"`
	PatternType string `json:"pattern_type"`
	Pattern     string `json:"pattern"`
	Score       int    `json:"score"`
	VerifyIP    bool   `json:"verify_ip"`
	Enabled     bool   `json:"enabled"`
	Description string `json:"description"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

type CreateBotPatternRequest struct {
	PatternType string `json:"pattern_type" validate:"required,oneof=good_bot bad_bot suspicious_ua bad_referer"`
	Pattern     string `json:"pattern" validate:"required"`
	Score       int    `json:"score"`
	VerifyIP    bool   `json:"verify_ip"`
	Enabled     bool   `json:"enabled"`
	Description string `json:"description"`
}

type UpdateBotPatternRequest struct {
	PatternType string `json:"pattern_type" validate:"required,oneof=good_bot bad_bot suspicious_ua bad_referer"`
	Pattern     string `json:"pattern" validate:"required"`
	Score       int    `json:"score"`
	VerifyIP    bool   `json:"verify_ip"`
	Enabled     bool   `json:"enabled"`
	Description string `json:"description"`
}

type BulkCreateBotPatternRequest struct {
	Patterns    []string `json:"patterns" validate:"required,min=1,max=500"`
	PatternType string   `json:"pattern_type" validate:"required,oneof=good_bot bad_bot suspicious_ua bad_referer"`
	Score       int      `json:"score"`
	VerifyIP    bool     `json:"verify_ip"`
	Enabled     bool     `json:"enabled"`
	Description string   `json:"description"`
}

type BulkUpdateBotPatternRequest struct {
	IDs         []int  `json:"ids" validate:"required,min=1,max=500"`
	PatternType string `json:"pattern_type,omitempty"`
	Score       *int   `json:"score,omitempty"`
	VerifyIP    *bool  `json:"verify_ip,omitempty"`
	Enabled     *bool  `json:"enabled,omitempty"`
}
