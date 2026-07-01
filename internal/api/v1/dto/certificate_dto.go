package dto

import "time"

type CertificateResponse struct {
	Domain          string     `json:"domain"`
	Status          string     `json:"status"`
	Issuer          string     `json:"issuer"`
	ExpiresAt       time.Time  `json:"expires_at"`
	DaysUntilExpiry int        `json:"days_until_expiry"`
	AutoRenew       bool       `json:"auto_renew"`
	IsExpiringSoon  bool       `json:"is_expiring_soon"`
	LastRenewAt     *time.Time `json:"last_renew_at,omitempty"`
	LastRenewStatus string     `json:"last_renew_status"`
}

type CertificateLogResponse struct {
	ID        int       `json:"id"`
	Domain    string    `json:"domain"`
	Action    string    `json:"action"`
	Status    string    `json:"status"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

type RenewCertificateRequest struct {
	Domain string `json:"domain"`
}

type IssueCertificateRequest struct {
	Domain string `json:"domain"`
	AppID  string `json:"app_id,omitempty"`
}

type ToggleAutoRenewRequest struct {
	Enabled bool `json:"enabled"`
}

type ValidateCertificateRequest struct {
	Domain string `json:"domain"`
}

type BulkDeleteRequest struct {
	Domains []string `json:"domains"`
}

type BulkDeleteResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Deleted int    `json:"deleted"`
}
