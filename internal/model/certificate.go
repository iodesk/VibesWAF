package model

import "time"

type Certificate struct {
	ID              int       `json:"id" db:"cert_id"`
	Domain          string    `json:"domain" db:"domain"`
	AppID           string    `json:"app_id" db:"app_id"`
	Status          string    `json:"status" db:"status"`
	Issuer          string    `json:"issuer" db:"issuer"`
	IssuedAt        time.Time `json:"issued_at" db:"issued_at"`
	ExpiresAt       time.Time `json:"expires_at" db:"expires_at"`
	AutoRenew       bool      `json:"auto_renew" db:"auto_renew"`
	LastRenewAt     *time.Time `json:"last_renew_at,omitempty" db:"last_renew_at"`
	LastRenewStatus string    `json:"last_renew_status" db:"last_renew_status"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
}

type CertificateLog struct {
	ID        int       `json:"id" db:"log_id"`
	CertID    int       `json:"cert_id" db:"cert_id"`
	Domain    string    `json:"domain" db:"domain"`
	Action    string    `json:"action" db:"action"`
	Status    string    `json:"status" db:"status"`
	Message   string    `json:"message" db:"message"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

type CertificateInfo struct {
	Domain          string    `json:"domain"`
	Status          string    `json:"status"`
	Issuer          string    `json:"issuer"`
	ExpiresAt       time.Time `json:"expires_at"`
	DaysUntilExpiry int       `json:"days_until_expiry"`
	AutoRenew       bool      `json:"auto_renew"`
	IsExpiringSoon  bool      `json:"is_expiring_soon"`
	LastRenewAt     *time.Time `json:"last_renew_at,omitempty"`
	LastRenewStatus string    `json:"last_renew_status"`
}
