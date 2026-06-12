package model

import "time"

type BotIPRange struct {
	ID          int       `db:"id" json:"id"`
	Name        string    `db:"name" json:"name"`
	SourceType  string    `db:"source_type" json:"source_type"` // "json_url" or "manual"
	URL         string    `db:"url" json:"url"`
	IPRanges    []string  `json:"ip_ranges"`
	Enabled     bool      `db:"enabled" json:"enabled"`
	Description string    `db:"description" json:"description"`
	LastFetched *time.Time `db:"last_fetched" json:"last_fetched"`
	CreatedAt   time.Time `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time `db:"updated_at" json:"updated_at"`
}
