package ip_access

import "time"


type IPAccessRule struct {
	ID          int       `json:"id" db:"id"`
	AppID       string    `json:"app_id" db:"app_id"`
	IPRange     string    `json:"ip_range" db:"ip_range"`
	Description string    `json:"description" db:"description"`
	Action      string    `json:"action" db:"action"`
	Enabled     bool      `json:"enabled" db:"enabled"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}


type CreateRequest struct {
	AppID       string `json:"-"`
	IPRange     string `json:"ip_range" validate:"required"`
	Description string `json:"description"`
	Action      string `json:"action" validate:"required,oneof=allow block challenge"`
	Enabled     bool   `json:"enabled"`
}


type UpdateRequest struct {
	IPRange     string `json:"ip_range"`
	Description string `json:"description"`
	Action      string `json:"action" validate:"oneof=allow block challenge"`
	Enabled     *bool  `json:"enabled"`
}
