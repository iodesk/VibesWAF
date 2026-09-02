package service

import (
	"fmt"
	"sync/atomic"
	"time"
	"unsafe"

	"github.com/iodesk/VibesWAF/internal/acme"
	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/domain/app"
	"github.com/iodesk/VibesWAF/internal/repository"
	"github.com/iodesk/VibesWAF/internal/stream"
)

type appSnapshot struct {
	byDomain map[string]*app.App
	byID     map[string]*app.App
}

type AppService struct {
	repo          repository.AppRepository
	acmeService   *acme.Service
	certService   *CertificateService
	healthChecker *HealthCheckService
	streamProxy   *stream.Proxy
	nginxManager  *stream.NginxManager

	snapshot unsafe.Pointer
	stopCh   chan struct{}
}

func NewAppService(repo repository.AppRepository, acmeService *acme.Service, certService *CertificateService, streamProxy *stream.Proxy, nginxManager *stream.NginxManager) *AppService {
	s := &AppService{
		repo:         repo,
		acmeService:  acmeService,
		certService:  certService,
		streamProxy:  streamProxy,
		nginxManager: nginxManager,
		stopCh:       make(chan struct{}),
	}
	s.healthChecker = NewHealthCheckService(s)
	s.reloadSnapshot()
	go s.autoReload()
	return s
}

func (s *AppService) getSnapshot() *appSnapshot {
	return (*appSnapshot)(atomic.LoadPointer(&s.snapshot))
}

func (s *AppService) reloadSnapshot() {
	apps, err := s.repo.ListAll()
	if err != nil {
		config.GetAppConfig().LogWarn("[AppService] Failed to reload app snapshot: %v", err)
		return
	}

	byDomain := make(map[string]*app.App, len(apps))
	byID := make(map[string]*app.App, len(apps))
	for _, a := range apps {
		byDomain[a.Domain] = a
		byID[a.ID] = a
	}

	atomic.StorePointer(&s.snapshot, unsafe.Pointer(&appSnapshot{byDomain: byDomain, byID: byID}))
}

func (s *AppService) autoReload() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.reloadSnapshot()
		}
	}
}

func (s *AppService) Stop() {
	select {
	case <-s.stopCh:
	default:
		close(s.stopCh)
	}
}

func (s *AppService) CreateApp(a *app.App) error {
	if err := a.Validate(); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	if a.IsStream() {
		if err := s.resolveStreamPort(a); err != nil {
			return err
		}
		if err := s.resolveStreamBackendPort(a); err != nil {
			return err
		}
	}

	if err := s.repo.Create(a); err != nil {
		return fmt.Errorf("failed to create app: %w", err)
	}

	s.reloadSnapshot()

	cfg := config.GetAppConfig()
	cfg.LogInfo("[AppService] Created app: %s (domain: %s) listen=%d backend=%d", a.ID, a.Domain, a.Config.ListenPort, a.Config.BackendPort)

	if a.IsStream() {
		s.setupStream(a)
	} else {
		if s.acmeService != nil {
			if err := s.certService.SyncFromACME(a.Domain, a.ID); err != nil {
				if err := s.certService.IssueDomain(a.Domain, a.ID); err != nil {
					cfg.LogWarn("[AppService] Failed to auto-issue cert for %s: %v", a.Domain, err)
				}
			}
		}
		s.healthChecker.Start(a)
	}

	return nil
}

func (s *AppService) UpdateApp(a *app.App) error {
	cfg := config.GetAppConfig()
	if cfg.DemoMode {
		existing, _ := s.repo.GetByID(a.ID)
		if existing != nil && existing.Domain == cfg.DemoDomain {
			return fmt.Errorf("cannot modify immortal domain in demo mode")
		}
	}

	if err := a.Validate(); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	if a.IsStream() {
		if err := s.resolveStreamPort(a); err != nil {
			return err
		}
		if err := s.resolveStreamBackendPort(a); err != nil {
			return err
		}
	}

	if err := s.repo.Update(a); err != nil {
		return fmt.Errorf("failed to update app: %w", err)
	}

	s.reloadSnapshot()

	cfg.LogInfo("[AppService] Updated app: %s", a.ID)

	if a.IsStream() {
		s.streamProxy.StopForApp(a.ID)
		s.setupStream(a)
	} else {
		s.healthChecker.Stop(a.ID)
		s.healthChecker.Start(a)
	}

	return nil
}

func (s *AppService) DeleteApp(id string) error {
	existing, _ := s.repo.GetByID(id)

	cfg := config.GetAppConfig()
	if cfg.DemoMode && existing != nil && existing.Domain == cfg.DemoDomain {
		return fmt.Errorf("cannot delete immortal domain in demo mode")
	}

	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("failed to delete app: %w", err)
	}

	s.reloadSnapshot()

	cfg.LogInfo("[AppService] Deleted app: %s", id)

	if existing != nil && existing.IsStream() {
		s.streamProxy.StopForApp(id)
		s.nginxManager.RemoveConf(id)
		s.nginxManager.Reload()
	} else {
		s.healthChecker.Stop(id)
	}

	return nil
}

func (s *AppService) GetApp(id string) (*app.App, error) {
	if snap := s.getSnapshot(); snap != nil {
		if a, ok := snap.byID[id]; ok {
			return a, nil
		}
	}
	return s.repo.GetByID(id)
}

func (s *AppService) GetAppByDomain(domain string) (*app.App, error) {
	if snap := s.getSnapshot(); snap != nil {
		if a, ok := snap.byDomain[domain]; ok {
			return a, nil
		}
		return nil, app.ErrAppNotFound
	}
	return s.repo.GetByDomain(domain)
}

func (s *AppService) ListApps() ([]*app.App, error) {
	return s.repo.ListAll()
}

func (s *AppService) ToggleUnderAttackMode(appID string, enabled bool) error {
	if err := s.repo.ToggleUnderAttackMode(appID, enabled); err != nil {
		return err
	}
	s.reloadSnapshot()
	return nil
}

// setupStream generates nginx conf with default cert, starts Go proxy, then
// issues domain cert async. When cert arrives, nginx will pick it up on next
// request (lua cache TTL) or on manual reload.
func (s *AppService) setupStream(a *app.App) {
	if err := s.nginxManager.GenerateConf(a); err != nil {
		config.GetAppConfig().LogError("[AppService] Failed to generate stream conf: %v", err)
		return
	}

	if err := s.nginxManager.Reload(); err != nil {
		config.GetAppConfig().LogError("[AppService] Nginx reload failed: %v", err)
		return
	}

	if err := s.streamProxy.StartForApp(a); err != nil {
		config.GetAppConfig().LogError("[AppService] Failed to start stream proxy: %v", err)
	}

	if s.acmeService != nil {
		if err := s.certService.SyncFromACME(a.Domain, a.ID); err != nil {
			if err := s.certService.IssueDomain(a.Domain, a.ID); err != nil {
				config.GetAppConfig().LogWarn("[AppService] Failed to auto-issue stream cert for %s: %v", a.Domain, err)
			}
		}
	}
}

func (s *AppService) StartStreamApps() {
	apps, err := s.repo.ListAll()
	if err != nil {
		config.GetAppConfig().LogError("[AppService] Failed to list apps for stream startup: %v", err)
		return
	}

	for _, a := range apps {
		if a.IsStream() {
			if err := s.streamProxy.StartForApp(a); err != nil {
				config.GetAppConfig().LogError("[AppService] Failed to start stream for app=%s: %v", a.ID, err)
			}
		} else {
			s.healthChecker.Start(a)
		}
	}
}

func (s *AppService) resolveStreamPort(a *app.App) error {
	minPort := app.StreamPortMin()
	maxPort := app.StreamPortMax()

	if a.Config.ListenPort == 0 {
		port, err := s.findAvailablePort(a.ID, minPort, maxPort)
		if err != nil {
			return err
		}
		a.Config.ListenPort = port
		return nil
	}

	return s.checkPortConflict(a.ID, a.Config.ListenPort)
}

func (s *AppService) resolveStreamBackendPort(a *app.App) error {
	minPort := app.StreamBackendMin()
	maxPort := app.StreamBackendMax()

	if a.Config.BackendPort == 0 {
		port, err := s.findAvailableBackendPort(a.ID, minPort, maxPort)
		if err != nil {
			return err
		}
		a.Config.BackendPort = port
		return nil
	}

	return s.checkBackendPortConflict(a.ID, a.Config.BackendPort)
}

func (s *AppService) findAvailablePort(excludeAppID string, minPort, maxPort int) (int, error) {
	apps, err := s.repo.ListAll()
	if err != nil {
		return 0, fmt.Errorf("failed to check port availability: %w", err)
	}

	used := make(map[int]bool)
	for _, existing := range apps {
		if existing.ID == excludeAppID {
			continue
		}
		if existing.IsStream() && existing.Config.ListenPort > 0 {
			used[existing.Config.ListenPort] = true
		}
	}

	for port := minPort; port <= maxPort; port++ {
		if !used[port] {
			return port, nil
		}
	}

	return 0, fmt.Errorf("no available port in range %d-%d", minPort, maxPort)
}

func (s *AppService) findAvailableBackendPort(excludeAppID string, minPort, maxPort int) (int, error) {
	apps, err := s.repo.ListAll()
	if err != nil {
		return 0, fmt.Errorf("failed to check backend port availability: %w", err)
	}

	used := make(map[int]bool)
	for _, existing := range apps {
		if existing.ID == excludeAppID {
			continue
		}
		if existing.IsStream() && existing.Config.BackendPort > 0 {
			used[existing.Config.BackendPort] = true
		}
	}

	for port := minPort; port <= maxPort; port++ {
		if !used[port] {
			return port, nil
		}
	}

	return 0, fmt.Errorf("no available backend port in range %d-%d", minPort, maxPort)
}

func (s *AppService) checkPortConflict(excludeAppID string, port int) error {
	apps, err := s.repo.ListAll()
	if err != nil {
		return fmt.Errorf("failed to check port conflict: %w", err)
	}

	for _, existing := range apps {
		if existing.ID == excludeAppID {
			continue
		}
		if existing.IsStream() && existing.Config.ListenPort == port {
			return fmt.Errorf("port %d is already used by app %s (%s)", port, existing.ID, existing.Domain)
		}
	}

	return nil
}

func (s *AppService) checkBackendPortConflict(excludeAppID string, port int) error {
	apps, err := s.repo.ListAll()
	if err != nil {
		return fmt.Errorf("failed to check backend port conflict: %w", err)
	}

	for _, existing := range apps {
		if existing.ID == excludeAppID {
			continue
		}
		if existing.IsStream() && existing.Config.BackendPort == port {
			return fmt.Errorf("backend port %d is already used by app %s (%s)", port, existing.ID, existing.Domain)
		}
	}

	return nil
}
