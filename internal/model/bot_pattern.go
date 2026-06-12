package model

import "time"


type BotPattern struct {
	ID          int       `db:"id"`
	PatternType string    `db:"pattern_type"`
	Pattern     string    `db:"pattern"`
	Score       int       `db:"score"`
	VerifyIP    bool      `db:"verify_ip"`
	Enabled     bool      `db:"enabled"`
	Description string    `db:"description"`
	CreatedAt   time.Time `db:"created_at"`
	UpdatedAt   time.Time `db:"updated_at"`

	// PatternLower is the lowercased Pattern, precomputed once at load time so
	// the request hot path avoids repeated strings.ToLower allocations.
	PatternLower string `db:"-"`
}


type BotWhitelist struct {
	ID          int       `db:"id"`
	IPRange     string    `db:"ip_range"`
	Description string    `db:"description"`
	CreatedAt   time.Time `db:"created_at"`
}


type BotScore struct {
	TotalScore int
	Reasons    []ScoreReason
	Action     string
	Evidence   string
	Metadata   map[string]interface{}
}


type ScoreReason struct {
	Rule  string
	Score int
}


func (bs *BotScore) Add(rule string, score int) {
	bs.TotalScore += score
	bs.Reasons = append(bs.Reasons, ScoreReason{
		Rule:  rule,
		Score: score,
	})
}
