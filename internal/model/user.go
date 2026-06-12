package model

import "time"


type User struct {
	ID           int       `json:"id" db:"id"`
	Username     string    `json:"username" db:"username"`
	PasswordHash string    `json:"-" db:"password_hash"`
	Email        string    `json:"email" db:"email"`
	Role         string    `json:"role" db:"role"`
	Enabled      bool      `json:"enabled" db:"enabled"`
	LastLogin    *time.Time `json:"last_login,omitempty" db:"last_login"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}


type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}


type ChangePasswordRequest struct {
	OldPassword string `json:"old_password"`
	NewPassword string `json:"new_password"`
}


type SetupRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Email    string `json:"email"`
}

type AuthResponse struct {
	User    *User  `json:"user"`
	Message string `json:"message,omitempty"`
}
