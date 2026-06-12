package challenge

import (
	"math/rand"
	"sync"
	"time"
)

type ValidateMeta struct {
	IP       string
	UA       string
	Duration time.Duration
}

type ChallengeData struct {
	ID        string
	Type      string
	Payload   map[string]interface{}
	Answer    int
	ExpiresAt time.Time
	Attempts  int
}

type ChallengeType interface {
	Generate() *ChallengeData
	Validate(data *ChallengeData, answer int, meta ValidateMeta) bool
	TypeName() string
}

type Registry struct {
	types []ChallengeType
	mu    sync.RWMutex
}

func NewRegistry() *Registry {
	return &Registry{
		types: make([]ChallengeType, 0),
	}
}

func (r *Registry) Register(ct ChallengeType) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.types = append(r.types, ct)
}

func (r *Registry) Pick() ChallengeType {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if len(r.types) == 0 {
		return nil
	}
	return r.types[rand.Intn(len(r.types))]
}

func (r *Registry) GetByType(typeName string) ChallengeType {
	r.mu.RLock()
	defer r.mu.RUnlock()
	for _, ct := range r.types {
		if ct.TypeName() == typeName {
			return ct
		}
	}
	return nil
}
