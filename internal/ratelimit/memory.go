package ratelimit

import (
	"sync"
	"time"
)

const memoryMaxKeys = 100_000

type MemoryLimiter struct {
	mu     sync.Mutex
	hits   map[string][]time.Time
	Limit  int
	Window time.Duration
}

func NewMemory(limit int, window time.Duration) *MemoryLimiter {
	m := &MemoryLimiter{
		hits:   make(map[string][]time.Time),
		Limit:  limit,
		Window: window,
	}
	go m.cleanupLoop()
	return m
}

func (m *MemoryLimiter) cleanupLoop() {
	ticker := time.NewTicker(2 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		m.cleanup()
	}
}

func (m *MemoryLimiter) cleanup() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for key, ts := range m.hits {
		var keep []time.Time
		for _, t := range ts {
			if now.Sub(t) < m.Window {
				keep = append(keep, t)
			}
		}
		if len(keep) == 0 {
			delete(m.hits, key)
		} else {
			m.hits[key] = keep
		}
	}
}

func (m *MemoryLimiter) Allow(key string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	timestamps := m.hits[key]

	var filtered []time.Time
	for _, t := range timestamps {
		if now.Sub(t) < m.Window {
			filtered = append(filtered, t)
		}
	}

	if len(filtered) >= m.Limit {
		return false
	}

	if len(m.hits) >= memoryMaxKeys && len(filtered) == 0 {
		return true
	}

	filtered = append(filtered, now)
	m.hits[key] = filtered
	return true
}
