package ratelimit

import (
	"crypto/sha256"
	"fmt"
	"sync"
	"time"
)

const (
	// MaxEntries is the hard cap on tracked keys.
	// At ~180 bytes per entry this caps memory at ~90MB.
	MaxEntries = 500_000
)

type bucket struct {
	tokens     float64
	capacity   float64
	refillRate float64
	lastRefill time.Time
	lastAccess time.Time
}

// RateLimiter manages per-key token buckets in a single flat map
// with one cleanup goroutine. Hard-capped at MaxEntries.
type RateLimiter struct {
	mu        sync.Mutex
	buckets   map[string]*bucket
	bucketTTL time.Duration
	maxSize   int
	stopCh    chan struct{}
}

func NewRateLimiter() *RateLimiter {
	rl := &RateLimiter{
		buckets:   make(map[string]*bucket),
		bucketTTL: 10 * time.Minute,
		maxSize:   MaxEntries,
		stopCh:    make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

// Stop terminates the cleanup goroutine.
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
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	for key, b := range rl.buckets {
		if now.Sub(b.lastAccess) > rl.bucketTTL {
			delete(rl.buckets, key)
		}
	}
}

// evictOldest removes the oldest-accessed entries to make room.
// Must be called with mu held.
func (rl *RateLimiter) evictOldest() {
	// Evict 10% of max to avoid evicting on every single insert.
	evictCount := rl.maxSize / 10
	if evictCount < 1 {
		evictCount = 1
	}

	for i := 0; i < evictCount; i++ {
		var oldestKey string
		var oldestTime time.Time
		first := true

		for k, b := range rl.buckets {
			if first || b.lastAccess.Before(oldestTime) {
				oldestKey = k
				oldestTime = b.lastAccess
				first = false
			}
		}

		if oldestKey != "" {
			delete(rl.buckets, oldestKey)
		}
	}
}

// Allow checks if a request for the given key is allowed.
// capacity = max tokens, refillRate = tokens per second.
func (rl *RateLimiter) Allow(key string, capacity int, refillRate float64) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cap := float64(capacity)

	b, exists := rl.buckets[key]
	if !exists {
		// Hard cap: evict oldest if at limit.
		if len(rl.buckets) >= rl.maxSize {
			rl.evictOldest()
		}

		b = &bucket{
			tokens:     cap,
			capacity:   cap,
			refillRate: refillRate,
			lastRefill: now,
			lastAccess: now,
		}
		rl.buckets[key] = b
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

// Size returns the current number of tracked keys.
func (rl *RateLimiter) Size() int {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	return len(rl.buckets)
}

func GenerateKey(ip, userAgent string) string {
	hash := sha256.Sum256([]byte(userAgent))
	uaHash := fmt.Sprintf("%x", hash[:8])
	return fmt.Sprintf("%s:%s", ip, uaHash)
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
