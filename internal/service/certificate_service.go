package service

import (
	"fmt"
	"net"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/iodesk/VibesWAF/internal/acme"
	"github.com/iodesk/VibesWAF/internal/api/v1/dto"
	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/model"
	"github.com/iodesk/VibesWAF/internal/repository"
)

type CertificateService struct {
	repo        *repository.CertificateRepository
	acmeService *acme.Service
	certDir     string
}

func NewCertificateService(repo *repository.CertificateRepository, acmeService *acme.Service) *CertificateService {
	certDir := os.Getenv("CERT_DIR")
	if certDir == "" {
		certDir = "/opt/certs"
	}
	
	return &CertificateService{
		repo:        repo,
		acmeService: acmeService,
		certDir:     certDir,
	}
}

func (s *CertificateService) ListAll() ([]*model.CertificateInfo, error) {
	certs, err := s.repo.ListAll()
	if err != nil {
		return nil, err
	}

	infos := make([]*model.CertificateInfo, len(certs))
	for i, cert := range certs {
		infos[i] = s.toCertificateInfo(cert)
	}

	return infos, nil
}

func (s *CertificateService) ListByAppID(appID string) ([]*model.CertificateInfo, error) {
	certs, err := s.repo.ListByAppID(appID)
	if err != nil {
		return nil, err
	}

	infos := make([]*model.CertificateInfo, len(certs))
	for i, cert := range certs {
		infos[i] = s.toCertificateInfo(cert)
	}

	return infos, nil
}

func (s *CertificateService) GetByDomain(domain string) (*model.CertificateInfo, error) {
	cert, err := s.repo.GetByDomain(domain)
	if err != nil {
		return nil, err
	}

	return s.toCertificateInfo(cert), nil
}

func (s *CertificateService) IssueDomain(domain, appID string) error {
	if s.acmeService == nil {
		return fmt.Errorf("ACME service not available - acme.sh not installed")
	}

	if _, err := s.repo.GetByDomain(domain); err == nil {
		return fmt.Errorf("certificate for %s already exists", domain)
	}

	if s.acmeService.HasWildcardCertificate(domain) {
		config.GetAppConfig().LogInfo("[CertService] Wildcard cert exists for %s, skipping issue", domain)
		return nil
	}

	config.GetAppConfig().LogInfo("[CertService] Starting manual issue for %s", domain)

	now := time.Now()
	cert := &model.Certificate{
		Domain:          domain,
		AppID:           appID,
		Status:          "pending",
		Issuer:          "",
		IssuedAt:        now,
		ExpiresAt:       now,
		AutoRenew:       true,
		LastRenewStatus: "pending",
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	if err := s.repo.Create(cert); err != nil {
		return fmt.Errorf("failed to create certificate record: %w", err)
	}

	s.logAction(cert.ID, domain, "issue", "started", "Manual issue initiated")

	onComplete := func(d string, err error) {
		if err != nil {
			config.GetAppConfig().LogError("[CertService] Issue failed for %s: %v", d, err)
			s.updateCertStatusAfterIssue(d, "failed", err.Error())
			return
		}
		s.updateCertStatusAfterIssue(d, "success", "Certificate issued successfully")
	}

	if err := s.acmeService.IssueAsync(domain, onComplete); err != nil {
		s.logAction(cert.ID, domain, "issue", "failed", err.Error())
		return fmt.Errorf("failed to issue certificate: %w", err)
	}

	s.logAction(cert.ID, domain, "issue", "pending", "Issue request submitted")

	return nil
}

func (s *CertificateService) RenewCertificate(domain string) error {	if s.acmeService == nil {
		return fmt.Errorf("ACME service not available - acme.sh not installed")
	}

	cert, err := s.repo.GetByDomain(domain)
	if err != nil {
		return fmt.Errorf("certificate not found: %w", err)
	}

	config.GetAppConfig().LogInfo("[CertService] Starting manual renewal for %s", domain)

	s.logAction(cert.ID, domain, "renew", "started", "Manual renewal initiated")

	onComplete := func(d string, err error) {
		if err != nil {
			config.GetAppConfig().LogError("[CertService] Renew failed for %s: %v", d, err)
			s.updateCertStatusAfterRenew(d, "failed", err.Error())
			return
		}
		s.updateCertStatusAfterRenew(d, "success", "Certificate renewed successfully")
	}

	if err := s.acmeService.RenewAsync(domain, onComplete); err != nil {
		s.logAction(cert.ID, domain, "renew", "failed", err.Error())
		return fmt.Errorf("failed to renew certificate: %w", err)
	}

	now := time.Now()
	cert.LastRenewAt = &now
	cert.LastRenewStatus = "pending"
	cert.UpdatedAt = now

	if err := s.repo.Update(cert); err != nil {
		return fmt.Errorf("failed to update certificate: %w", err)
	}

	s.logAction(cert.ID, domain, "renew", "pending", "Renewal request submitted")

	return nil
}

func (s *CertificateService) ValidateCertificate(domain string) (*model.CertificateInfo, error) {
	config.GetAppConfig().LogInfo("[CertService] Validating certificate for %s", domain)

	// Check if certificate files exist
	certPath := fmt.Sprintf("%s/%s/fullchain.pem", s.certDir, domain)
	
	if _, err := os.Stat(certPath); err != nil {
		return nil, fmt.Errorf("certificate not found on filesystem")
	}

	// Read expiry date using openssl
	cmd := exec.Command("openssl", "x509", "-enddate", "-noout", "-in", certPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("failed to check certificate expiry: %w", err)
	}

	dateStr := strings.TrimPrefix(string(output), "notAfter=")
	dateStr = strings.TrimSpace(dateStr)

	expiryDate, err := time.Parse("Jan 2 15:04:05 2006 MST", dateStr)
	if err != nil {
		return nil, fmt.Errorf("failed to parse expiry date: %w", err)
	}

	issuer, err := s.getCertificateIssuer(domain)
	if err != nil {
		config.GetAppConfig().LogWarn("[CertService] Failed to get issuer for %s: %v", domain, err)
		issuer = "Unknown"
	}

	cert, err := s.repo.GetByDomain(domain)
	if err != nil {
		return nil, fmt.Errorf("certificate not found in database: %w", err)
	}

	cert.Status = s.determineStatus(expiryDate)
	cert.Issuer = issuer
	cert.ExpiresAt = expiryDate
	cert.UpdatedAt = time.Now()

	if err := s.repo.Update(cert); err != nil {
		return nil, fmt.Errorf("failed to update certificate: %w", err)
	}

	s.logAction(cert.ID, domain, "validate", "success", fmt.Sprintf("Certificate validated, expires: %s", expiryDate.Format("2006-01-02")))

	info := s.toCertificateInfo(cert)
	daysUntilExpiry := int(time.Until(expiryDate).Hours() / 24)
	info.IsExpiringSoon = daysUntilExpiry < 30

	return info, nil
}

func (s *CertificateService) ToggleAutoRenew(domain string, enabled bool) error {
	cert, err := s.repo.GetByDomain(domain)
	if err != nil {
		return fmt.Errorf("certificate not found: %w", err)
	}

	if err := s.repo.ToggleAutoRenew(cert.ID, enabled); err != nil {
		return err
	}

	action := "disabled"
	if enabled {
		action = "enabled"
	}

	s.logAction(cert.ID, domain, "auto_renew", action, fmt.Sprintf("Auto-renew %s", action))

	config.GetAppConfig().LogInfo("[CertService] Auto-renew %s for %s", action, domain)

	return nil
}

func (s *CertificateService) GetLogs(domain string, limit int) ([]*model.CertificateLog, error) {
	return s.repo.GetLogsByDomain(domain, limit)
}

func (s *CertificateService) DeleteCertificate(domain string) error {
	config.GetAppConfig().LogInfo("[CertService] Deleting certificate for %s", domain)

	cert, err := s.repo.GetByDomain(domain)
	if err != nil {
		return fmt.Errorf("certificate not found: %w", err)
	}

	if cert.WildcardEnabled && s.acmeService != nil {
		base := strings.TrimPrefix(domain, "*.")
		s.acmeService.RemoveWildcard(base)
	} else if s.acmeService != nil {
		s.acmeService.RemoveCert(domain)
	}

	if err := s.repo.DeleteByDomain(domain); err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to delete certificate %s: %v", domain, err)
		return fmt.Errorf("failed to delete certificate: %w", err)
	}

	config.GetAppConfig().LogInfo("[CertService] Certificate %s deleted (ID: %d)", domain, cert.ID)
	return nil
}

func (s *CertificateService) BulkDeleteCertificates(domains []string) (int, error) {
	if len(domains) == 0 {
		return 0, fmt.Errorf("no domains provided")
	}

	config.GetAppConfig().LogInfo("[CertService] Bulk delete requested for %d certificates", len(domains))

	deleted, err := s.repo.BulkDelete(domains)
	if err != nil {
		config.GetAppConfig().LogError("[CertService] Bulk delete failed: %v", err)
		return 0, fmt.Errorf("failed to bulk delete certificates: %w", err)
	}

	config.GetAppConfig().LogInfo("[CertService] Bulk delete completed: %d/%d certificates deleted", deleted, len(domains))
	return deleted, nil
}

func (s *CertificateService) SyncFromACME(domain, appID string) error {
	config.GetAppConfig().LogDebug("[CertService] Syncing certificate for domain: %s", domain)
	
	certPath := fmt.Sprintf("%s/%s/fullchain.pem", s.certDir, domain)
	keyPath := fmt.Sprintf("%s/%s/key.pem", s.certDir, domain)

	if _, err := os.Stat(certPath); err != nil {
		dotIdx := strings.Index(domain, ".")
		if dotIdx > 0 {
			parentDomain := domain[dotIdx+1:]
			wildcardPath := fmt.Sprintf("%s/wildcard.%s/fullchain.pem", s.certDir, parentDomain)
			if _, werr := os.Stat(wildcardPath); werr == nil {
				config.GetAppConfig().LogInfo("[CertService] Found wildcard cert for %s (wildcard.%s)", domain, parentDomain)
				return s.syncWildcardCert(parentDomain, appID)
			}
		}
		config.GetAppConfig().LogInfo("[CertService] Certificate not yet issued for %s (will issue async)", domain)
		return fmt.Errorf("certificate not found on filesystem: %w", err)
	}

	if _, err := os.Stat(keyPath); err != nil {
		config.GetAppConfig().LogInfo("[CertService] Key not yet issued for %s (will issue async)", domain)
		return fmt.Errorf("key not found on filesystem: %w", err)
	}

	config.GetAppConfig().LogDebug("[CertService] Certificate files found for %s", domain)

	// Read expiry date using openssl
	cmd := exec.Command("openssl", "x509", "-enddate", "-noout", "-in", certPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to read expiry for %s: %v", domain, err)
		return fmt.Errorf("failed to check certificate expiry: %w", err)
	}

	dateStr := strings.TrimPrefix(string(output), "notAfter=")
	dateStr = strings.TrimSpace(dateStr)

	expiryDate, err := time.Parse("Jan 2 15:04:05 2006 MST", dateStr)
	if err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to parse expiry date for %s: %v", domain, err)
		return fmt.Errorf("failed to parse expiry date: %w", err)
	}

	config.GetAppConfig().LogDebug("[CertService] Certificate expires at: %s", expiryDate.Format("2006-01-02"))

	issuer, err := s.getCertificateIssuer(domain)
	if err != nil {
		config.GetAppConfig().LogWarn("[CertService] Failed to get issuer for %s: %v", domain, err)
		issuer = "Let's Encrypt"
	}

	cert, err := s.repo.GetByDomain(domain)
	if err != nil {
		// Create new certificate record
		config.GetAppConfig().LogDebug("[CertService] Creating new certificate record for %s", domain)
		
		cert = &model.Certificate{
			Domain:          domain,
			AppID:           appID,
			Status:          s.determineStatus(expiryDate),
			Issuer:          issuer,
			IssuedAt:        time.Now(),
			ExpiresAt:       expiryDate,
			AutoRenew:       true,
			LastRenewStatus: "success",
			CreatedAt:       time.Now(),
			UpdatedAt:       time.Now(),
		}

		if err := s.repo.Create(cert); err != nil {
			config.GetAppConfig().LogError("[CertService] Failed to create certificate record for %s: %v", domain, err)
			return fmt.Errorf("failed to create certificate: %w", err)
		}

		s.logAction(cert.ID, domain, "sync", "success", "Certificate synced from filesystem")
		config.GetAppConfig().LogInfo("[CertService] Created certificate record for %s (expires: %s)", domain, expiryDate.Format("2006-01-02"))
	} else {
		// Update existing certificate record
		config.GetAppConfig().LogDebug("[CertService] Updating existing certificate record for %s", domain)
		
		cert.Status = s.determineStatus(expiryDate)
		cert.Issuer = issuer
		cert.ExpiresAt = expiryDate
		cert.UpdatedAt = time.Now()

		if err := s.repo.Update(cert); err != nil {
			config.GetAppConfig().LogError("[CertService] Failed to update certificate record for %s: %v", domain, err)
			return fmt.Errorf("failed to update certificate: %w", err)
		}

		s.logAction(cert.ID, domain, "sync", "success", "Certificate updated from filesystem")
		config.GetAppConfig().LogInfo("[CertService] Updated certificate record for %s (expires: %s)", domain, expiryDate.Format("2006-01-02"))
	}

	return nil
}

func (s *CertificateService) SyncAllFromFilesystem() error {
	config.GetAppConfig().LogInfo("[CertService] Starting filesystem sync from: %s", s.certDir)
	
	entries, err := os.ReadDir(s.certDir)
	if err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to read cert directory %s: %v", s.certDir, err)
		return fmt.Errorf("failed to read cert directory: %w", err)
	}

	config.GetAppConfig().LogDebug("[CertService] Found %d entries in cert directory", len(entries))

	synced := 0
	skipped := 0
	
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		domain := entry.Name()
		config.GetAppConfig().LogDebug("[CertService] Processing domain: %s", domain)
		
		// Check if certificate files exist
		certPath := fmt.Sprintf("%s/%s/fullchain.pem", s.certDir, domain)
		keyPath := fmt.Sprintf("%s/%s/key.pem", s.certDir, domain)
		
		certInfo, certErr := os.Stat(certPath)
		keyInfo, keyErr := os.Stat(keyPath)
		
		if certErr != nil || keyErr != nil {
			config.GetAppConfig().LogDebug("[CertService] Skipping %s: missing certificate files (cert: %v, key: %v)", domain, certErr, keyErr)
			skipped++
			continue
		}
		
		if certInfo.Size() == 0 || keyInfo.Size() == 0 {
			config.GetAppConfig().LogDebug("[CertService] Skipping %s: empty certificate files", domain)
			skipped++
			continue
		}

		// Try to sync
		if err := s.SyncFromACME(domain, ""); err != nil {
			config.GetAppConfig().LogWarn("[CertService] Failed to sync %s: %v", domain, err)
			skipped++
			continue
		}

		synced++
	}

	config.GetAppConfig().LogInfo("[CertService] Sync complete: %d synced, %d skipped", synced, skipped)
	return nil
}

func (s *CertificateService) updateCertStatusAfterIssue(domain, newStatus, message string) {
	cert, err := s.repo.GetByDomain(domain)
	if err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to get cert after issue for %s: %v", domain, err)
		return
	}

	// Re-read expiry from updated files
	certPath := fmt.Sprintf("%s/%s/fullchain.pem", s.certDir, domain)
	cmd := exec.Command("openssl", "x509", "-enddate", "-noout", "-in", certPath)
	output, cerr := cmd.CombinedOutput()
	if cerr == nil {
		dateStr := strings.TrimPrefix(string(output), "notAfter=")
		dateStr = strings.TrimSpace(dateStr)
		if expiryDate, err := time.Parse("Jan 2 15:04:05 2006 MST", dateStr); err == nil {
			cert.ExpiresAt = expiryDate
		}
		issuer, _ := s.getCertificateIssuer(domain)
		cert.Issuer = issuer
	}

	cert.Status = newStatus
	cert.LastRenewStatus = newStatus
	now := time.Now()
	cert.LastRenewAt = &now
	cert.UpdatedAt = now

	if newStatus == "success" {
		cert.Status = s.determineStatus(cert.ExpiresAt)
	}

	if err := s.repo.Update(cert); err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to update cert after issue for %s: %v", domain, err)
		return
	}

	s.logAction(cert.ID, domain, "issue", newStatus, message)
	config.GetAppConfig().LogInfo("[CertService] Certificate %s issued: %s", domain, newStatus)
}

func (s *CertificateService) updateCertStatusAfterRenew(domain, newStatus, message string) {
	cert, err := s.repo.GetByDomain(domain)
	if err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to get cert after renew for %s: %v", domain, err)
		return
	}

	// Re-read expiry from updated files
	certPath := fmt.Sprintf("%s/%s/fullchain.pem", s.certDir, domain)
	cmd := exec.Command("openssl", "x509", "-enddate", "-noout", "-in", certPath)
	output, cerr := cmd.CombinedOutput()
	if cerr == nil {
		dateStr := strings.TrimPrefix(string(output), "notAfter=")
		dateStr = strings.TrimSpace(dateStr)
		if expiryDate, err := time.Parse("Jan 2 15:04:05 2006 MST", dateStr); err == nil {
			cert.ExpiresAt = expiryDate
		}
		issuer, _ := s.getCertificateIssuer(domain)
		cert.Issuer = issuer
	}

	cert.Status = newStatus
	cert.LastRenewStatus = newStatus
	now := time.Now()
	cert.LastRenewAt = &now
	cert.UpdatedAt = now

	if newStatus == "success" {
		cert.Status = s.determineStatus(cert.ExpiresAt)
	}

	if err := s.repo.Update(cert); err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to update cert after renew for %s: %v", domain, err)
		return
	}

	s.logAction(cert.ID, domain, "renew", newStatus, message)
	config.GetAppConfig().LogInfo("[CertService] Certificate %s renewed: %s", domain, newStatus)
}

func (s *CertificateService) toCertificateInfo(cert *model.Certificate) *model.CertificateInfo {
	daysUntilExpiry := int(time.Until(cert.ExpiresAt).Hours() / 24)
	isExpiringSoon := cert.Status != "pending" && daysUntilExpiry < 30

	return &model.CertificateInfo{
		Domain:          cert.Domain,
		Status:          cert.Status,
		Issuer:          cert.Issuer,
		ExpiresAt:       cert.ExpiresAt,
		DaysUntilExpiry: daysUntilExpiry,
		AutoRenew:       cert.AutoRenew,
		IsExpiringSoon:  isExpiringSoon,
		LastRenewAt:     cert.LastRenewAt,
		LastRenewStatus: cert.LastRenewStatus,
		WildcardEnabled: cert.WildcardEnabled,
		WildcardStatus:  cert.WildcardStatus,
		WildcardMethod:  cert.WildcardMethod,
	}
}

func (s *CertificateService) determineStatus(expiresAt time.Time) string {
	daysUntilExpiry := int(time.Until(expiresAt).Hours() / 24)

	if daysUntilExpiry < 0 {
		return "expired"
	} else if daysUntilExpiry < 30 {
		return "expiring_soon"
	}

	return "valid"
}

func (s *CertificateService) getCertificateIssuer(domain string) (string, error) {
	certPath := fmt.Sprintf("%s/%s/fullchain.pem", s.certDir, domain)
	
	config.GetAppConfig().LogDebug("[CertService] Getting issuer for %s from %s", domain, certPath)

	cmd := exec.Command("openssl", "x509", "-issuer", "-noout", "-in", certPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to get issuer: %v", err)
		return "", fmt.Errorf("failed to get certificate issuer: %w", err)
	}

	issuerStr := strings.TrimPrefix(string(output), "issuer=")
	issuerStr = strings.TrimSpace(issuerStr)

	if strings.Contains(issuerStr, "Let's Encrypt") {
		return "Let's Encrypt", nil
	} else if strings.Contains(issuerStr, "ZeroSSL") {
		return "ZeroSSL", nil
	}

	return issuerStr, nil
}

func (s *CertificateService) logAction(certID int, domain, action, status, message string) {
	log := &model.CertificateLog{
		CertID:    certID,
		Domain:    domain,
		Action:    action,
		Status:    status,
		Message:   message,
		CreatedAt: time.Now(),
	}

	if err := s.repo.CreateLog(log); err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to create log: %v", err)
	}
}

var wildcardDomainRe = regexp.MustCompile(`^\*\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?){1,2}$`)

func (s *CertificateService) EnableWildcard(domain string, method string) (*dto.WildcardSetupResponse, error) {
	if s.acmeService == nil {
		return nil, fmt.Errorf("ACME service not available - acme.sh not installed")
	}

	domain = strings.TrimPrefix(domain, "*.")

	if !wildcardDomainRe.MatchString("*." + domain) {
		return nil, fmt.Errorf("invalid domain: only *.domain.com or *.sub.domain.com are supported")
	}

	if method != "persist" && method != "dns" {
		return nil, fmt.Errorf("invalid method: must be 'persist' or 'dns'")
	}

	if method == "dns" {
		if os.Getenv("CF_Token") == "" || os.Getenv("CF_Email") == "" {
			return nil, fmt.Errorf("CF_Token and CF_Email must be configured in .env for DNS wildcard method")
		}
	}

	wildcardDomain := "*." + domain

	cert, err := s.repo.GetByDomain(wildcardDomain)
	if err != nil {
		now := time.Now()
		cert = &model.Certificate{
			Domain:          wildcardDomain,
			AppID:           "",
			Status:          "pending",
			Issuer:          "",
			IssuedAt:        now,
			ExpiresAt:       now,
			AutoRenew:       true,
			LastRenewStatus: "pending",
			WildcardEnabled: true,
			WildcardStatus:  "issuing",
			WildcardMethod:  method,
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		if err := s.repo.Create(cert); err != nil {
			return nil, fmt.Errorf("failed to create wildcard certificate record: %w", err)
		}
	} else if cert.WildcardStatus == "active" {
		return nil, fmt.Errorf("wildcard certificate already active for %s", domain)
	} else {
		cert.WildcardEnabled = true
		cert.WildcardStatus = "issuing"
		cert.WildcardMethod = method
		cert.UpdatedAt = time.Now()
		if err := s.repo.Update(cert); err != nil {
			return nil, fmt.Errorf("failed to update certificate: %w", err)
		}
	}

	if method == "persist" {
		config.GetAppConfig().LogInfo("[CertService] Generating DNS persist value for %s", domain)
		txtName, txtValue, err := s.acmeService.MakePersistValue(domain)
		if err != nil {
			return nil, fmt.Errorf("failed to generate DNS persist value: %w", err)
		}
		if txtName == "" || txtValue == "" {
			return nil, fmt.Errorf("failed to parse acme.sh output — TXT record not generated")
		}
		cert.WildcardStatus = "txt_pending"
		cert.PersistTXTValue = txtValue
		if err := s.repo.Update(cert); err != nil {
			return nil, fmt.Errorf("failed to update certificate: %w", err)
		}
		s.logAction(cert.ID, wildcardDomain, "wildcard_enable", "txt_pending", "DNS persist value generated")
		return &dto.WildcardSetupResponse{
			Domain:         domain,
			TXTName:        txtName,
			TXTValue:       txtValue,
			WildcardStatus: "txt_pending",
		}, nil
	}

	config.GetAppConfig().LogInfo("[CertService] Enabling wildcard for %s via Cloudflare DNS", domain)
	s.logAction(cert.ID, wildcardDomain, "wildcard_enable", "issuing", "Wildcard issue initiated via Cloudflare DNS-01")

	onComplete := func(d string, err error) {
		if err != nil {
			config.GetAppConfig().LogError("[CertService] Wildcard issue failed for %s: %v", domain, err)
			s.updateWildcardStatusAfterIssue(domain, "failed", err.Error())
			return
		}
		s.updateWildcardStatusAfterIssue(domain, "success", "Wildcard certificate issued successfully")
	}

	if err := s.acmeService.IssueWildcardAsync(domain, "dns", onComplete); err != nil {
		s.logAction(cert.ID, wildcardDomain, "wildcard_enable", "failed", err.Error())
		cert.WildcardStatus = "failed"
		s.repo.Update(cert)
		return nil, fmt.Errorf("failed to issue wildcard certificate: %w", err)
	}

	return nil, nil
}

func (s *CertificateService) VerifyWildcardDNS(domain string) (bool, error) {
	domain = strings.TrimPrefix(domain, "*.")
	txtName := "_validation-persist." + domain

	config.GetAppConfig().LogInfo("[CertService] Verifying DNS TXT record for %s", txtName)

	lookups, err := net.LookupTXT(txtName)
	if err != nil {
		config.GetAppConfig().LogInfo("[CertService] DNS lookup failed for %s: %v", txtName, err)
		return false, nil
	}

	for _, txt := range lookups {
		if strings.Contains(txt, "accounturi") {
			config.GetAppConfig().LogInfo("[CertService] DNS TXT verified for %s", txtName)
			wildcardDomain := "*." + domain
			cert, err := s.repo.GetByDomain(wildcardDomain)
			if err == nil && cert.WildcardStatus == "txt_pending" {
				cert.WildcardStatus = "dns_verified"
				cert.UpdatedAt = time.Now()
				s.repo.Update(cert)
			}
			return true, nil
		}
	}

	config.GetAppConfig().LogInfo("[CertService] DNS TXT not found or invalid for %s", txtName)
	return false, nil
}

func (s *CertificateService) IssueWildcardCert(domain string) error {
	if s.acmeService == nil {
		return fmt.Errorf("ACME service not available - acme.sh not installed")
	}

	domain = strings.TrimPrefix(domain, "*.")
	wildcardDomain := "*." + domain

	cert, err := s.repo.GetByDomain(wildcardDomain)
	if err != nil {
		return fmt.Errorf("wildcard certificate not found for %s", domain)
	}

	if cert.WildcardStatus == "active" {
		return fmt.Errorf("wildcard certificate already active for %s", domain)
	}

	if cert.WildcardStatus != "dns_verified" && cert.WildcardStatus != "failed" {
		return fmt.Errorf("DNS record not verified yet for %s", domain)
	}

	method := cert.WildcardMethod
	if method == "" {
		method = "persist"
	}

	if cert.WildcardStatus == "failed" {
		s.acmeService.RemoveWildcard(domain)
	}

	config.GetAppConfig().LogInfo("[CertService] Starting wildcard issue for %s (method: %s)", domain, method)

	cert.WildcardStatus = "issuing"
	cert.UpdatedAt = time.Now()
	if err := s.repo.Update(cert); err != nil {
		return fmt.Errorf("failed to update certificate status: %w", err)
	}

	s.logAction(cert.ID, wildcardDomain, "wildcard_issue", "started", "Wildcard issue initiated")

	onComplete := func(d string, err error) {
		if err != nil {
			config.GetAppConfig().LogError("[CertService] Wildcard issue failed for %s: %v", domain, err)
			s.updateWildcardStatusAfterIssue(domain, "failed", err.Error())
			return
		}
		s.updateWildcardStatusAfterIssue(domain, "success", "Wildcard certificate issued successfully")
	}

	if err := s.acmeService.IssueWildcardAsync(domain, method, onComplete); err != nil {
		s.logAction(cert.ID, wildcardDomain, "wildcard_issue", "failed", err.Error())
		cert.WildcardStatus = "failed"
		s.repo.Update(cert)
		return fmt.Errorf("failed to issue wildcard certificate: %w", err)
	}

	s.logAction(cert.ID, wildcardDomain, "wildcard_issue", "pending", "Issue request submitted")
	return nil
}

func (s *CertificateService) DisableWildcard(domain string) error {
	domain = strings.TrimPrefix(domain, "*.")
	wildcardDomain := "*." + domain

	cert, err := s.repo.GetByDomain(wildcardDomain)
	if err != nil {
		return fmt.Errorf("wildcard certificate not found for %s", domain)
	}

	cert.WildcardEnabled = false
	cert.WildcardStatus = "none"
	if err := s.repo.Update(cert); err != nil {
		return fmt.Errorf("failed to update certificate: %w", err)
	}

	s.logAction(cert.ID, wildcardDomain, "wildcard_disable", "success", "Wildcard disabled")
	config.GetAppConfig().LogInfo("[CertService] Wildcard disabled for %s", domain)
	return nil
}

func (s *CertificateService) updateWildcardStatusAfterIssue(domain, newStatus, message string) {
	wildcardDomain := "*." + domain
	cert, err := s.repo.GetByDomain(wildcardDomain)
	if err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to get wildcard cert after issue for %s: %v", domain, err)
		return
	}

	certDir := "wildcard." + domain
	certPath := fmt.Sprintf("%s/%s/fullchain.pem", s.certDir, certDir)
	cmd := exec.Command("openssl", "x509", "-enddate", "-noout", "-in", certPath)
	output, cerr := cmd.CombinedOutput()
	if cerr == nil {
		dateStr := strings.TrimPrefix(string(output), "notAfter=")
		dateStr = strings.TrimSpace(dateStr)
		if expiryDate, err := time.Parse("Jan 2 15:04:05 2006 MST", dateStr); err == nil {
			cert.ExpiresAt = expiryDate
		}
		issuer, _ := s.getCertificateIssuer(certDir)
		cert.Issuer = issuer
	}

	if newStatus == "success" {
		cert.WildcardStatus = "active"
		cert.Status = s.determineStatus(cert.ExpiresAt)
	} else {
		cert.WildcardStatus = "failed"
	}

	now := time.Now()
	cert.LastRenewAt = &now
	cert.LastRenewStatus = newStatus
	cert.UpdatedAt = now

	if err := s.repo.Update(cert); err != nil {
		config.GetAppConfig().LogError("[CertService] Failed to update wildcard cert after issue for %s: %v", domain, err)
		return
	}

	s.logAction(cert.ID, wildcardDomain, "wildcard_issue", newStatus, message)
	config.GetAppConfig().LogInfo("[CertService] Wildcard certificate %s issued: %s", domain, newStatus)
}

func (s *CertificateService) syncWildcardCert(baseDomain, appID string) error {
	wildcardDomain := "*." + baseDomain
	certPath := fmt.Sprintf("%s/wildcard.%s/fullchain.pem", s.certDir, baseDomain)

	cmd := exec.Command("openssl", "x509", "-enddate", "-noout", "-in", certPath)
	output, cerr := cmd.CombinedOutput()
	if cerr != nil {
		return fmt.Errorf("failed to check wildcard certificate expiry: %w", cerr)
	}

	dateStr := strings.TrimPrefix(string(output), "notAfter=")
	dateStr = strings.TrimSpace(dateStr)

	expiryDate, err := time.Parse("Jan 2 15:04:05 2006 MST", dateStr)
	if err != nil {
		return fmt.Errorf("failed to parse wildcard certificate expiry date: %w", err)
	}

	issuer, err := s.getCertificateIssuer("wildcard." + baseDomain)
	if err != nil {
		issuer = "Let's Encrypt"
	}

	cert, err := s.repo.GetByDomain(wildcardDomain)
	if err != nil {
		now := time.Now()
		cert = &model.Certificate{
			Domain:          wildcardDomain,
			AppID:           appID,
			Status:          s.determineStatus(expiryDate),
			Issuer:          issuer,
			IssuedAt:        now,
			ExpiresAt:       expiryDate,
			AutoRenew:       true,
			LastRenewStatus: "success",
			WildcardEnabled: true,
			WildcardStatus:  "active",
			CreatedAt:       now,
			UpdatedAt:       now,
		}
		if err := s.repo.Create(cert); err != nil {
			return fmt.Errorf("failed to create wildcard certificate record: %w", err)
		}
		s.logAction(cert.ID, wildcardDomain, "sync", "success", "Wildcard certificate synced from filesystem")
	} else {
		cert.Status = s.determineStatus(expiryDate)
		cert.Issuer = issuer
		cert.ExpiresAt = expiryDate
		cert.WildcardEnabled = true
		cert.WildcardStatus = "active"
		cert.UpdatedAt = time.Now()
		if err := s.repo.Update(cert); err != nil {
			return fmt.Errorf("failed to update wildcard certificate record: %w", err)
		}
		s.logAction(cert.ID, wildcardDomain, "sync", "success", "Wildcard certificate updated from filesystem")
	}

	config.GetAppConfig().LogInfo("[CertService] Synced wildcard cert for %s (expires: %s)", baseDomain, expiryDate.Format("2006-01-02"))
	return nil
}
