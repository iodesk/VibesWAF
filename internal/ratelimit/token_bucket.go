package ratelimit

import (
	"hash/fnv"
	"sync"
	"time"
)

const (
	MaxEntries       = 500_000
	rateLimitShards  = 256
	maxPerShard      = MaxEntries / rateLimitShards
)

type bucket struct {
	tokens     float64
	capacity   float64
	refillRate float64
	lastRefill time.Time
	lastAccess time.Time
}

type rateLimitShard struct {
	mu      sync.Mutex
	buckets map[string]*bucket
}

type RateLimiter struct {
	shards    [rateLimitShards]*rateLimitShard
	bucketTTL time.Duration
	stopCh    chan struct{}
}

func NewRateLimiter() *RateLimiter {
	rl := &RateLimiter{
		bucketTTL: 10 * time.Minute,
		stopCh:    make(chan struct{}),
	}
	for i := range rl.shards {
		rl.shards[i] = &rateLimitShard{
			buckets: make(map[string]*bucket),
		}
	}
	go rl.cleanupLoop()
	return rl
}

func (rl *RateLimiter) shardFor(key string) *rateLimitShard {
	h := fnv.New32a()
	_, _ = h.Write([]byte(key))
	return rl.shards[h.Sum32()%rateLimitShards]
}

func (rl *RateLimiter) Stop() {
	select {
	case <-rl.stopCh:
	default:
		close(rl.stopCh)
	}
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-rl.stopCh:
			return
		case <-ticker.C:
			rl.cleanup()
		}
	}
}

func (rl *RateLimiter) cleanup() {
	now := time.Now()
	for _, sh := range rl.shards {
		sh.mu.Lock()
		for key, b := range sh.buckets {
			if now.Sub(b.lastAccess) > rl.bucketTTL {
				delete(sh.buckets, key)
			}
		}
		sh.mu.Unlock()
	}
}

func (sh *rateLimitShard) evictOldest() {
	evictCount := maxPerShard / 10
	if evictCount < 1 {
		evictCount = 1
	}

	for i := 0; i < evictCount; i++ {
		var oldestKey string
		var oldestTime time.Time
		first := true

		for k, b := range sh.buckets {
			if first || b.lastAccess.Before(oldestTime) {
				oldestKey = k
				oldestTime = b.lastAccess
				first = false
			}
		}

		if oldestKey != "" {
			delete(sh.buckets, oldestKey)
		}
	}
}

func (rl *RateLimiter) Allow(key string, capacity int, refillRate float64) bool {
	sh := rl.shardFor(key)
	sh.mu.Lock()
	defer sh.mu.Unlock()

	now := time.Now()
	cap := float64(capacity)

	b, exists := sh.buckets[key]
	if !exists {
		if len(sh.buckets) >= maxPerShard {
			sh.evictOldest()
		}

		b = &bucket{
			tokens:     cap,
			capacity:   cap,
			refillRate: refillRate,
			lastRefill: now,
			lastAccess: now,
		}
		sh.buckets[key] = b
	}

	b.lastAccess = now

	if b.capacity != cap || b.refillRate != refillRate {
		b.capacity = cap
		b.refillRate = refillRate
		if b.tokens > cap {
			b.tokens = cap
		}
	}

	elapsed := now.Sub(b.lastRefill).Seconds()
	if elapsed >= 0.01 {
		b.tokens = min(b.capacity, b.tokens+elapsed*b.refillRate)
		b.lastRefill = now
	}

	if b.tokens >= 1.0 {
		b.tokens -= 1.0
		return true
	}
	return false
}

func (rl *RateLimiter) Size() int {
	total := 0
	for _, sh := range rl.shards {
		sh.mu.Lock()
		total += len(sh.buckets)
		sh.mu.Unlock()
	}
	return total
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
