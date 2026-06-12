package challenge

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"
)

const (
	// MaxChallenges is the hard cap on active challenges.
	// At ~200 bytes per entry = ~20MB max.
	MaxChallenges = 100_000
)

type solveRecord struct {
	count    int
	windowStart time.Time
}

type Store struct {
	mu         sync.RWMutex
	challenges map[string]*ChallengeData
	maxRetries int
	maxSize    int
	ttl        time.Duration
	stopCh     chan struct{}

	// Rate limiting for challenge solves per IP
	solveMu       sync.Mutex
	solveTracker  map[string]*solveRecord
	solveMax      int           // max solves per window
	solveWindow   time.Duration // window duration
}

func NewStore(ttl time.Duration, maxRetries int) *Store {
	s := &Store{
		challenges:   make(map[string]*ChallengeData),
		maxRetries:   maxRetries,
		maxSize:      MaxChallenges,
		ttl:          ttl,
		stopCh:       make(chan struct{}),
		solveTracker: make(map[string]*solveRecord),
		solveMax:     5,
		solveWindow:  1 * time.Hour,
	}
	go s.cleanup()
	return s
}

// Stop terminates the cleanup goroutine.
func (s *Store) Stop() {
	select {
	case <-s.stopCh:
	default:
		close(s.stopCh)
	}
}

func (s *Store) Create(ct ChallengeType) *ChallengeData {
	data := ct.Generate()
	data.ID = generateID()
	data.ExpiresAt = time.Now().Add(s.ttl)
	data.Attempts = 0

	s.mu.Lock()
	// Hard cap: if at limit, evict expired first, then oldest.
	if len(s.challenges) >= s.maxSize {
		s.evictLocked()
	}
	s.challenges[data.ID] = data
	s.mu.Unlock()

	return data
}

// evictLocked removes expired entries first, then oldest if still over cap.
// Must be called with mu held.
func (s *Store) evictLocked() {
	now := time.Now()

	// Pass 1: remove all expired
	for id, data := range s.challenges {
		if now.After(data.ExpiresAt) {
			delete(s.challenges, id)
		}
	}

	// If still over cap, remove oldest 10%
	if len(s.challenges) >= s.maxSize {
		evictCount := s.maxSize / 10
		if evictCount < 1 {
			evictCount = 1
		}
		for i := 0; i < evictCount; i++ {
			var oldestID string
			var oldestTime time.Time
			first := true
			for id, data := range s.challenges {
				if first || data.ExpiresAt.Before(oldestTime) {
					oldestID = id
					oldestTime = data.ExpiresAt
					first = false
				}
			}
			if oldestID != "" {
				delete(s.challenges, oldestID)
			}
		}
	}
}

func (s *Store) Get(id string) *ChallengeData {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, ok := s.challenges[id]
	if !ok {
		return nil
	}
	if time.Now().After(data.ExpiresAt) {
		return nil
	}
	return data
}

func (s *Store) IncrementAttempts(id string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, ok := s.challenges[id]
	if !ok {
		return -1
	}
	data.Attempts++
	return data.Attempts
}

func (s *Store) MaxRetries() int {
	return s.maxRetries
}

func (s *Store) TTLSeconds() int {
	return int(s.ttl.Seconds())
}

func (s *Store) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.challenges, id)
}

// IsSolveRateLimited checks if an IP has exceeded the solve rate limit.
func (s *Store) IsSolveRateLimited(ip string) bool {
	s.solveMu.Lock()
	defer s.solveMu.Unlock()

	rec, ok := s.solveTracker[ip]
	if !ok {
		return false
	}

	// Reset if window expired
	if time.Since(rec.windowStart) > s.solveWindow {
		delete(s.solveTracker, ip)
		return false
	}

	return rec.count >= s.solveMax
}

// RecordSolve records a successful challenge solve for rate limiting.
func (s *Store) RecordSolve(ip string) {
	s.solveMu.Lock()
	defer s.solveMu.Unlock()

	rec, ok := s.solveTracker[ip]
	if !ok || time.Since(rec.windowStart) > s.solveWindow {
		s.solveTracker[ip] = &solveRecord{count: 1, windowStart: time.Now()}
		return
	}
	rec.count++
}

// SolveCount returns how many times an IP has solved in current window.
func (s *Store) SolveCount(ip string) int {
	s.solveMu.Lock()
	defer s.solveMu.Unlock()

	rec, ok := s.solveTracker[ip]
	if !ok {
		return 0
	}
	if time.Since(rec.windowStart) > s.solveWindow {
		delete(s.solveTracker, ip)
		return 0
	}
	return rec.count
}

func (s *Store) cleanup() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.mu.Lock()
			now := time.Now()
			for id, data := range s.challenges {
				if now.After(data.ExpiresAt) {
					delete(s.challenges, id)
				}
			}
			s.mu.Unlock()

			// Clean expired solve records
			s.solveMu.Lock()
			for ip, rec := range s.solveTracker {
				if time.Since(rec.windowStart) > s.solveWindow {
					delete(s.solveTracker, ip)
				}
			}
			s.solveMu.Unlock()
		}
	}
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
