package acme

import (
	"fmt"
	"os"
	"os/exec"

	"github.com/vibeswaf/waf/internal/config"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type job struct {
	domain     string
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
	return append(os.Environ(),
		"HOME="+home,
		"LE_WORKING_DIR="+s.acmeHome,
	)
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

func (s *Service) enqueue(domain string, force bool, onComplete func(domain string, err error)) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, j := range s.queue {
		if j.domain == domain {
			config.GetAppConfig().LogDebug("[ACME] %s already queued, skipping duplicate", domain)
			return
		}
	}

	s.queue = append(s.queue, job{domain: domain, force: force, onComplete: onComplete})

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
			err := s.issue(j.domain, j.force)
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
	if s.HasCertificate(domain) {
		return nil
	}
	s.enqueue(domain, false, onComplete)
	return nil
}

func (s *Service) RenewAsync(domain string, onComplete func(domain string, err error)) error {
	s.enqueue(domain, true, onComplete)
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
