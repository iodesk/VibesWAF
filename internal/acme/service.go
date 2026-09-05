package acme

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/iodesk/VibesWAF/internal/config"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type job struct {
	domain     string
	method     string
	force      bool
	onComplete func(domain string, err error)
}

type Service struct {
	acmeShPath string
	acmeHome   string
	certDir    string
	email      string
	mu         sync.Mutex
	queue      []job
	workerBusy bool
}

func NewService(certDir, email string) *Service {
	acmeShPath := os.Getenv("ACME_SH_PATH")
	if acmeShPath == "" {
		homeDir, _ := os.UserHomeDir()
		acmeShPath = filepath.Join(homeDir, ".acme.sh", "acme.sh")
	}

	acmeHome := filepath.Dir(acmeShPath)

	return &Service{
		acmeShPath: acmeShPath,
		acmeHome:   acmeHome,
		certDir:    certDir,
		email:      email,
	}
}

func (s *Service) acmeEnv() []string {
	home := filepath.Dir(s.acmeHome)
	path := os.Getenv("PATH")
	if path == "" {
		path = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
	}
	env := []string{
		"HOME=" + home,
		"LE_WORKING_DIR=" + s.acmeHome,
		"PATH=" + path,
	}
	if cfToken := os.Getenv("CF_Token"); cfToken != "" {
		env = append(env, "CF_Token="+cfToken)
	}
	if cfEmail := os.Getenv("CF_Email"); cfEmail != "" {
		env = append(env, "CF_Email="+cfEmail)
	}
	return env
}

func (s *Service) IsInstalled() bool {
	_, err := os.Stat(s.acmeShPath)
	return err == nil
}

func (s *Service) HasCertificate(domain string) bool {
	certPath := filepath.Join(s.certDir, domain, "fullchain.pem")
	keyPath := filepath.Join(s.certDir, domain, "key.pem")

	certInfo, certErr := os.Stat(certPath)
	keyInfo, keyErr := os.Stat(keyPath)

	if certErr != nil || keyErr != nil {
		return false
	}

	return certInfo.Size() > 0 && keyInfo.Size() > 0
}

func (s *Service) enqueue(domain string, method string, force bool, onComplete func(domain string, err error)) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, j := range s.queue {
		if j.domain == domain {
			config.GetAppConfig().LogDebug("[ACME] %s already queued, skipping duplicate", domain)
			return
		}
	}

	s.queue = append(s.queue, job{domain: domain, method: method, force: force, onComplete: onComplete})

	if !s.workerBusy {
		s.workerBusy = true
		go s.worker()
	}
}

func (s *Service) worker() {
	for {
		s.mu.Lock()
		if len(s.queue) == 0 {
			s.workerBusy = false
			s.mu.Unlock()
			return
		}
		j := s.queue[0]
		s.queue = s.queue[1:]
		s.mu.Unlock()

		func() {
			var err error
			if strings.HasPrefix(j.domain, "*.") {
				baseDomain := strings.TrimPrefix(j.domain, "*.")
				err = s.issueWildcard(baseDomain, j.method, j.force)
			} else {
				err = s.issue(j.domain, j.force)
			}
			if err != nil {
				config.GetAppConfig().LogError("[ACME] Failed to process %s: %v", j.domain, err)
			} else {
				config.GetAppConfig().LogInfo("[ACME] Processed %s successfully", j.domain)
			}
			if j.onComplete != nil {
				j.onComplete(j.domain, err)
			}
		}()
	}
}

func (s *Service) IssueAsync(domain string, onComplete func(domain string, err error)) error {
	if s.HasCertificate(domain) || s.HasWildcardCertificate(domain) {
		return nil
	}
	s.enqueue(domain, "", false, onComplete)
	return nil
}

func (s *Service) RenewAsync(domain string, onComplete func(domain string, err error)) error {
	s.enqueue(domain, "", true, onComplete)
	return nil
}

func (s *Service) issue(domain string, force bool) error {
	if !s.IsInstalled() {
		return fmt.Errorf("acme.sh not installed at %s", s.acmeShPath)
	}

	domainCertDir := filepath.Join(s.certDir, domain)
	if err := os.MkdirAll(domainCertDir, 0755); err != nil {
		return fmt.Errorf("failed to create cert directory: %w", err)
	}

	args := []string{
		"--issue",
		"-d", domain,
		"--standalone",
		"--httpport", "8080",
	}
	if force {
		args = append(args, "--force")
	}

	issueCmd := exec.Command(s.acmeShPath, args...)
	issueCmd.Env = s.acmeEnv()

	output, err := issueCmd.CombinedOutput()
	if err != nil {
		if strings.Contains(string(output), "already issued") {
			return s.installCert(domain)
		}
		return fmt.Errorf("failed to issue certificate: %w\nOutput: %s", err, string(output))
	}

	return s.installCert(domain)
}

func (s *Service) issueWildcard(baseDomain string, method string, force bool) error {
	if !s.IsInstalled() {
		return fmt.Errorf("acme.sh not installed at %s", s.acmeShPath)
	}

	wildcardDomain := "*." + baseDomain
	wildcardCertDir := filepath.Join(s.certDir, "wildcard."+baseDomain)
	if err := os.MkdirAll(wildcardCertDir, 0755); err != nil {
		return fmt.Errorf("failed to create wildcard cert directory: %w", err)
	}

	args := []string{
		"--issue",
		"-d", wildcardDomain,
		"-d", baseDomain,
	}

	switch method {
	case "dns":
		args = append(args, "--dns", "dns_cf", "--dnssleep", "10")
	default:
		args = append(args, "--dns-persist")
	}

	if force {
		args = append(args, "--force")
	}

	issueCmd := exec.Command(s.acmeShPath, args...)
	issueCmd.Env = s.acmeEnv()

	output, err := issueCmd.CombinedOutput()
	if err != nil {
		if strings.Contains(string(output), "already issued") {
			return s.installWildcardCert(baseDomain)
		}
		return fmt.Errorf("failed to issue wildcard certificate: %w\nOutput: %s", err, string(output))
	}

	return s.installWildcardCert(baseDomain)
}

func (s *Service) MakePersistValue(baseDomain string) (string, string, error) {
	if !s.IsInstalled() {
		return "", "", fmt.Errorf("acme.sh not installed at %s", s.acmeShPath)
	}

	args := []string{
		"--make-dns-persist-value",
		"-d", baseDomain,
		"--dns-persist-wildcard",
	}

	cmd := exec.Command(s.acmeShPath, args...)
	cmd.Env = s.acmeEnv()

	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate persist value: %w\nOutput: %s", err, string(output))
	}

	txtName := ""
	txtValue := ""

	for _, line := range strings.Split(string(output), "\n") {
		line = strings.TrimSpace(line)
		if idx := strings.Index(line, "TXT persist domain:"); idx >= 0 {
			txtName = strings.TrimSpace(line[idx+len("TXT persist domain:"):])
		} else if idx := strings.Index(line, "TXT persist value :"); idx >= 0 {
			txtValue = strings.TrimSpace(line[idx+len("TXT persist value :"):])
			txtValue = strings.Trim(txtValue, "\"")
		}
	}

	return txtName, txtValue, nil
}

func (s *Service) installWildcardCert(baseDomain string) error {
	wildcardDomain := "*." + baseDomain
	wildcardCertDir := filepath.Join(s.certDir, "wildcard."+baseDomain)
	keyPath := filepath.Join(wildcardCertDir, "key.pem")
	fullchainPath := filepath.Join(wildcardCertDir, "fullchain.pem")

	installCmd := exec.Command(
		s.acmeShPath,
		"--install-cert",
		"-d", wildcardDomain,
		"--key-file", keyPath,
		"--fullchain-file", fullchainPath,
		"--reloadcmd", ":",
	)
	installCmd.Env = s.acmeEnv()

	output, err := installCmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to install wildcard certificate: %w\nOutput: %s", err, string(output))
	}

	os.Chmod(keyPath, 0644)
	os.Chmod(fullchainPath, 0644)

	return nil
}

func (s *Service) IssueWildcardAsync(baseDomain string, method string, onComplete func(domain string, err error)) error {
	wildcardDomain := "*." + baseDomain
	s.enqueue(wildcardDomain, method, false, onComplete)
	return nil
}

func (s *Service) RenewWildcardAsync(baseDomain string, method string, onComplete func(domain string, err error)) error {
	wildcardDomain := "*." + baseDomain
	s.enqueue(wildcardDomain, method, true, onComplete)
	return nil
}

func (s *Service) HasWildcardCertificate(baseDomain string) bool {
	certPath := filepath.Join(s.certDir, "wildcard."+baseDomain, "fullchain.pem")
	keyPath := filepath.Join(s.certDir, "wildcard."+baseDomain, "key.pem")

	certInfo, certErr := os.Stat(certPath)
	keyInfo, keyErr := os.Stat(keyPath)

	if certErr != nil || keyErr != nil {
		return false
	}

	return certInfo.Size() > 0 && keyInfo.Size() > 0
}

func (s *Service) installCert(domain string) error {
	domainCertDir := filepath.Join(s.certDir, domain)
	keyPath := filepath.Join(domainCertDir, "key.pem")
	fullchainPath := filepath.Join(domainCertDir, "fullchain.pem")

	installCmd := exec.Command(
		s.acmeShPath,
		"--install-cert",
		"-d", domain,
		"--key-file", keyPath,
		"--fullchain-file", fullchainPath,
		"--reloadcmd", ":",
	)
	installCmd.Env = s.acmeEnv()

	output, err := installCmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to install certificate: %w\nOutput: %s", err, string(output))
	}

	os.Chmod(keyPath, 0644)
	os.Chmod(fullchainPath, 0644)

	return nil
}

func (s *Service) CheckExpiry(domain string) (bool, time.Time, error) {
	certPath := filepath.Join(s.certDir, domain, "fullchain.pem")

	cmd := exec.Command("openssl", "x509", "-enddate", "-noout", "-in", certPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return false, time.Time{}, fmt.Errorf("failed to check certificate expiry: %w", err)
	}

	dateStr := strings.TrimPrefix(string(output), "notAfter=")
	dateStr = strings.TrimSpace(dateStr)

	expiryDate, err := time.Parse("Jan 2 15:04:05 2006 MST", dateStr)
	if err != nil {
		return false, time.Time{}, fmt.Errorf("failed to parse expiry date: %w", err)
	}

	daysUntilExpiry := time.Until(expiryDate).Hours() / 24
	isExpiringSoon := daysUntilExpiry < 30

	return isExpiringSoon, expiryDate, nil
}

func (s *Service) AutoProvision(domain string) {
	if s.HasCertificate(domain) {
		return
	}
	s.IssueAsync(domain, nil)
}

func (s *Service) RemoveWildcard(baseDomain string) error {
	wildcardDomain := "*." + baseDomain

	// Remove our cert dir
	wildcardCertDir := filepath.Join(s.certDir, "wildcard."+baseDomain)
	os.RemoveAll(wildcardCertDir)

	// Remove acme.sh internal cert dir
	acmeCertDir := filepath.Join(s.acmeHome, wildcardDomain)
	os.RemoveAll(acmeCertDir)

	config.GetAppConfig().LogInfo("[ACME] Removed wildcard cert data for %s", baseDomain)
	return nil
}

func (s *Service) RemoveCert(domain string) error {
	certDir := filepath.Join(s.certDir, domain)
	os.RemoveAll(certDir)

	acmeCertDir := filepath.Join(s.acmeHome, domain)
	os.RemoveAll(acmeCertDir)

	config.GetAppConfig().LogInfo("[ACME] Removed cert data for %s", domain)
	return nil
}
