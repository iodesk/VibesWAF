package service

import (
	"context"
	"fmt"
	"time"

	appcfg "github.com/vibeswaf/waf/internal/config"
	"github.com/vibeswaf/waf/internal/domain/app"
	"github.com/vibeswaf/waf/internal/repository"
)
type DemoService struct {
	appRepo      repository.AppRepository
	certRepo     *repository.CertificateRepository
	settingsRepo *repository.SettingsRepository
	appCfg       *appcfg.AppConfig
	stopCh       chan struct{}
}

func NewDemoService(
	appRepo repository.AppRepository,
	certRepo *repository.CertificateRepository,
	settingsRepo *repository.SettingsRepository,
) *DemoService {
	return &DemoService{
		appRepo:      appRepo,
		certRepo:     certRepo,
		settingsRepo: settingsRepo,
		appCfg:       appcfg.GetAppConfig(),
		stopCh:       make(chan struct{}),
	}
}

func (s *DemoService) Start() {
	if !s.appCfg.DemoMode {
		return
	}

	autoReset := s.appCfg.ResetIntervalH > 0
	s.appCfg.LogStartup("[Demo] enabled  imo=%s  auto_del=%dh  reset=%v",
		s.appCfg.DemoDomain, s.appCfg.ResetIntervalH, autoReset)

	if err := s.seedImmortals(); err != nil {
		s.appCfg.LogError("[Demo] seed failed: %v", err)
	}

	if autoReset {
		go s.runScheduler()
	}
}

func (s *DemoService) Stop() {
	select {
	case <-s.stopCh:
	default:
		close(s.stopCh)
	}
}

func (s *DemoService) runScheduler() {
	interval := time.Duration(s.appCfg.ResetIntervalH) * time.Hour
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.reset()
		}
	}
}

func (s *DemoService) seedImmortals() error {
	_, err := s.appRepo.GetByDomain(s.appCfg.DemoDomain)
	if err == nil {
		return nil
	}

	id := fmt.Sprintf("imo-%d", time.Now().UnixNano())
	immortal := &app.App{
		ID:     id,
		Domain: s.appCfg.DemoDomain,
		Config: app.DefaultAppConfig(),
	}

	if err := s.appRepo.Create(immortal); err != nil {
		return fmt.Errorf("create immortal domain: %w", err)
	}

	s.appCfg.LogInfo("[Demo] seeded immortal domain: %s", s.appCfg.DemoDomain)
	return nil
}

func (s *DemoService) reset() {
	_, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := s.appRepo.DeleteAllExcept(s.appCfg.DemoDomain); err != nil {
		s.appCfg.LogError("[Demo] delete non-immortal apps failed: %v", err)
		return
	}

	if err := s.certRepo.DeleteAllExcept(s.appCfg.DemoDomain); err != nil {
		s.appCfg.LogError("[Demo] delete non-immortal certs failed: %v", err)
		return
	}

	if err := s.settingsRepo.Update("last_demo_reset", time.Now().Unix()); err != nil {
		s.appCfg.LogWarn("[Demo] update last_demo_reset failed: %v", err)
	}

	s.appCfg.LogInfo("[Demo] reset completed")
}
