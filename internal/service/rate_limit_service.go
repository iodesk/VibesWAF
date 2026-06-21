package service

import (
	"sync/atomic"
	"time"
	"unsafe"

	appcfg "github.com/vibeswaf/waf/internal/config"
	"github.com/vibeswaf/waf/internal/model"
	"github.com/vibeswaf/waf/internal/ratelimit"
	"github.com/vibeswaf/waf/internal/repository"
)

// globalRLState is swapped atomically on reload - zero lock on hot path.
type globalRLState struct {
	cfg     model.RateLimitConfig
	limiter *ratelimit.RateLimiter
}

type RateLimitService struct {
	settingsRepo *repository.SettingsRepository

	// state is read via atomic load on every request - zero lock contention.
	state unsafe.Pointer // *globalRLState

	// hit counters per profile type - incremented atomically
	hitsBasic  int64
	hitsAttack int64
	hitsError  int64

	reloadInterval time.Duration
	stopCh         chan struct{}
}

func NewRateLimitService(settingsRepo *repository.SettingsRepository) *RateLimitService {
	s := &RateLimitService{
		settingsRepo:   settingsRepo,
		reloadInterval: 30 * time.Second,
		stopCh:         make(chan struct{}),
	}

	cfg, err := settingsRepo.GetRateLimitConfig()
	if err != nil {
		appcfg.GetAppConfig().LogWarn("[RateLimit] Failed to load config, using defaults: %v", err)
		cfg = model.DefaultRateLimitConfig()
	}

	limiter := ratelimit.NewRateLimiter()
	atomic.StorePointer(&s.state, unsafe.Pointer(&globalRLState{cfg: cfg, limiter: limiter}))

	go s.autoReload()
	return s
}

func (s *RateLimitService) getState() *globalRLState {
	return (*globalRLState)(atomic.LoadPointer(&s.state))
}

// GetConfig returns the cached rate limit config via an atomic read.
func (s *RateLimitService) GetConfig() model.RateLimitConfig {
	return s.getState().cfg
}

func (s *RateLimitService) autoReload() {
	ticker := time.NewTicker(s.reloadInterval)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			cfg, err := s.settingsRepo.GetRateLimitConfig()
			if err != nil {
				appcfg.GetAppConfig().LogWarn("[RateLimit] Failed to reload config: %v", err)
				continue
			}

			old := s.getState()
			limiter := ratelimit.NewRateLimiter()
			next := &globalRLState{cfg: cfg, limiter: limiter}
			atomic.StorePointer(&s.state, unsafe.Pointer(next))

			if old != nil && old.limiter != nil {
				old.limiter.Stop()
			}
		}
	}
}

// Stop terminates the autoReload goroutine and the current limiter.
func (s *RateLimitService) Stop() {
	select {
	case <-s.stopCh:
	default:
		close(s.stopCh)
	}
	if st := s.getState(); st != nil && st.limiter != nil {
		st.limiter.Stop()
	}
}

// Allow returns (allowed bool, action string).
func (s *RateLimitService) Allow(appID, clientIP, userAgent string) (bool, string) {
	globalCfg := s.getState().cfg
	basic := globalCfg.Basic

	if !basic.Enabled || basic.Count <= 0 || basic.Duration <= 0 {
		appcfg.GetAppConfig().LogDebug("[RATE_LIMIT_SVC] Disabled for app=%s", appID)
		return true, ""
	}

	refillRate := float64(basic.Count) / float64(max(basic.Duration, 1))
	key := ratelimit.GenerateKey(clientIP, userAgent)
	bucketKey := appID + ":" + key

	st := s.getState()
	allowed := st.limiter.Allow(bucketKey, basic.Count, refillRate)

	if !allowed {
		appcfg.GetAppConfig().LogInfo("[RATE_LIMIT] blocked app=%s ip=%s (limit: %d req/%ds action=%s)",
			appID, clientIP, basic.Count, basic.Duration, basic.Action)
		atomic.AddInt64(&s.hitsBasic, 1)
	}

	return allowed, basic.Action
}

// InvalidateCache stops the current limiter and creates a fresh one.
func (s *RateLimitService) InvalidateCache(appID string) {
	old := s.getState()
	cfg := old.cfg

	limiter := ratelimit.NewRateLimiter()
	next := &globalRLState{cfg: cfg, limiter: limiter}
	atomic.StorePointer(&s.state, unsafe.Pointer(next))

	if old.limiter != nil {
		old.limiter.Stop()
	}
}

// RecordAttackHit increments the attack hit counter.
func (s *RateLimitService) RecordAttackHit() {
	atomic.AddInt64(&s.hitsAttack, 1)
}

// RecordErrorHit increments the error hit counter.
func (s *RateLimitService) RecordErrorHit() {
	atomic.AddInt64(&s.hitsError, 1)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}