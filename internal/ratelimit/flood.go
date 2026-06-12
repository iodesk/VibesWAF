package ratelimit

import (
	"hash/fnv"
	"sync"
	"time"
)

const (
	// floodShards is the number of independently-locked partitions.
	// Requests for different IPs hash to different shards, so they no longer
	// serialize on a single global mutex — critical for high concurrency.
	floodShards = 256
	// floodMaxKeysPerShard caps entries per shard (total ≈ shards × this).
	floodMaxKeysPerShard = 50_000 / floodShards
)

// FloodConfig holds current limits — read dynamically per check.
type FloodConfig struct {
	BasicLimit   int
	BasicWindow  time.Duration
	AttackLimit  int
	AttackWindow time.Duration
	ErrorLimit   int
	ErrorWindow  time.Duration
}

// floodShard is one independently-locked partition of the flood state.
type floodShard struct {
	mu sync.Mutex

	basicAccess map[string][]time.Time
	attackCount map[string][]time.Time
	errorCount  map[string][]time.Time
	challenged  map[string]time.Time
}

func newFloodShard() *floodShard {
	return &floodShard{
		basicAccess: make(map[string][]time.Time),
		attackCount: make(map[string][]time.Time),
		errorCount:  make(map[string][]time.Time),
		challenged:  make(map[string]time.Time),
	}
}

type FloodProtector struct {
	shards [floodShards]*floodShard

	cfgMu     sync.RWMutex
	getConfig func() FloodConfig
	stopCh    chan struct{}
}

func NewFloodProtector(basicLimit, attackLimit, errorLimit int, basicWindow, attackWindow, errorWindow time.Duration) *FloodProtector {
	staticCfg := FloodConfig{
		BasicLimit:   basicLimit,
		BasicWindow:  basicWindow,
		AttackLimit:  attackLimit,
		AttackWindow: attackWindow,
		ErrorLimit:   errorLimit,
		ErrorWindow:  errorWindow,
	}
	f := &FloodProtector{
		getConfig: func() FloodConfig { return staticCfg },
		stopCh:    make(chan struct{}),
	}
	for i := range f.shards {
		f.shards[i] = newFloodShard()
	}
	go f.cleanupLoop()
	return f
}

// shardFor returns the shard responsible for an IP.
func (f *FloodProtector) shardFor(ip string) *floodShard {
	h := fnv.New32a()
	_, _ = h.Write([]byte(ip))
	return f.shards[h.Sum32()%floodShards]
}

func (f *FloodProtector) cfg() FloodConfig {
	f.cfgMu.RLock()
	fn := f.getConfig
	f.cfgMu.RUnlock()
	return fn()
}

// SetConfigGetter replaces the static config with a dynamic getter.
// Call this after construction to enable runtime config reload.
func (f *FloodProtector) SetConfigGetter(fn func() FloodConfig) {
	f.cfgMu.Lock()
	f.getConfig = fn
	f.cfgMu.Unlock()
}

func (f *FloodProtector) Stop() {
	select {
	case <-f.stopCh:
	default:
		close(f.stopCh)
	}
}

func (f *FloodProtector) cleanupLoop() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-f.stopCh:
			return
		case <-ticker.C:
			f.cleanup()
		}
	}
}

func (f *FloodProtector) cleanup() {
	cfg := f.cfg()
	now := time.Now()

	for _, sh := range f.shards {
		sh.mu.Lock()
		for ip, ts := range sh.basicAccess {
			if kept := filterRecent(ts, now, cfg.BasicWindow); len(kept) == 0 {
				delete(sh.basicAccess, ip)
			} else {
				sh.basicAccess[ip] = kept
			}
		}
		for ip, ts := range sh.attackCount {
			if kept := filterRecent(ts, now, cfg.AttackWindow); len(kept) == 0 {
				delete(sh.attackCount, ip)
			} else {
				sh.attackCount[ip] = kept
			}
		}
		for ip, ts := range sh.errorCount {
			if kept := filterRecent(ts, now, cfg.ErrorWindow); len(kept) == 0 {
				delete(sh.errorCount, ip)
			} else {
				sh.errorCount[ip] = kept
			}
		}
		for ip, expiry := range sh.challenged {
			if now.After(expiry) {
				delete(sh.challenged, ip)
			}
		}
		sh.mu.Unlock()
	}
}

// filterRecent compacts ts in place, keeping only timestamps within window.
// Reuses the backing array — no new allocation on the hot path.
func filterRecent(ts []time.Time, now time.Time, window time.Duration) []time.Time {
	n := 0
	for _, t := range ts {
		if now.Sub(t) < window {
			ts[n] = t
			n++
		}
	}
	return ts[:n]
}

func (f *FloodProtector) CheckBasicAccess(ip string) bool {
	cfg := f.cfg()
	now := time.Now()

	sh := f.shardFor(ip)
	sh.mu.Lock()
	defer sh.mu.Unlock()

	kept := filterRecent(sh.basicAccess[ip], now, cfg.BasicWindow)

	if len(kept) >= cfg.BasicLimit {
		sh.basicAccess[ip] = kept
		return false
	}

	if len(sh.basicAccess) >= floodMaxKeysPerShard && len(kept) == 0 {
		return true
	}

	sh.basicAccess[ip] = append(kept, now)
	return true
}

func (f *FloodProtector) RecordAttack(ip string) {
	cfg := f.cfg()

	sh := f.shardFor(ip)
	sh.mu.Lock()
	defer sh.mu.Unlock()

	if len(sh.attackCount) >= floodMaxKeysPerShard {
		return
	}
	if len(sh.attackCount[ip]) >= cfg.AttackLimit {
		return
	}
	sh.attackCount[ip] = append(sh.attackCount[ip], time.Now())
}

func (f *FloodProtector) CheckAttackLimit(ip string) bool {
	cfg := f.cfg()
	now := time.Now()

	sh := f.shardFor(ip)
	sh.mu.Lock()
	defer sh.mu.Unlock()

	kept := filterRecent(sh.attackCount[ip], now, cfg.AttackWindow)
	sh.attackCount[ip] = kept
	return len(kept) < cfg.AttackLimit
}

func (f *FloodProtector) RecordError(ip string) {
	cfg := f.cfg()

	sh := f.shardFor(ip)
	sh.mu.Lock()
	defer sh.mu.Unlock()

	if len(sh.errorCount) >= floodMaxKeysPerShard {
		return
	}
	if len(sh.errorCount[ip]) >= cfg.ErrorLimit {
		return
	}
	sh.errorCount[ip] = append(sh.errorCount[ip], time.Now())
}

func (f *FloodProtector) CheckErrorLimit(ip string) bool {
	cfg := f.cfg()
	now := time.Now()

	sh := f.shardFor(ip)
	sh.mu.Lock()
	defer sh.mu.Unlock()

	kept := filterRecent(sh.errorCount[ip], now, cfg.ErrorWindow)
	sh.errorCount[ip] = kept
	return len(kept) < cfg.ErrorLimit
}

func (f *FloodProtector) SetChallenge(ip string, duration time.Duration) {
	sh := f.shardFor(ip)
	sh.mu.Lock()
	sh.challenged[ip] = time.Now().Add(duration)
	sh.mu.Unlock()
}

func (f *FloodProtector) IsChallenged(ip string) bool {
	sh := f.shardFor(ip)
	sh.mu.Lock()
	defer sh.mu.Unlock()

	expiry, exists := sh.challenged[ip]
	if !exists {
		return false
	}

	if time.Now().After(expiry) {
		// Penalty expired — clear all counters so IP starts fresh.
		delete(sh.challenged, ip)
		delete(sh.basicAccess, ip)
		delete(sh.attackCount, ip)
		delete(sh.errorCount, ip)
		return false
	}

	return true
}
