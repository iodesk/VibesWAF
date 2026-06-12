package store

import (
	"sync"
	"time"
)

type item struct {
	value  interface{}
	expiry time.Time
}

type Memory struct {
	mu    sync.RWMutex
	items map[string]item
}

func NewMemory() *Memory {
	m := &Memory{
		items: make(map[string]item),
	}
	go m.cleanup()
	return m
}

func (m *Memory) Get(key string) (interface{}, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	item, exists := m.items[key]
	if !exists {
		return nil, false
	}

	if time.Now().After(item.expiry) {
		return nil, false
	}

	return item.value, true
}

func (m *Memory) Set(key string, value interface{}, ttl time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.items[key] = item{
		value:  value,
		expiry: time.Now().Add(ttl),
	}
}

func (m *Memory) Del(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.items, key)
}

func (m *Memory) cleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		m.mu.Lock()
		now := time.Now()
		for key, item := range m.items {
			if now.After(item.expiry) {
				delete(m.items, key)
			}
		}
		m.mu.Unlock()
	}
}
