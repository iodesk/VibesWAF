package handlers

import (
	"context"
	"testing"
	"time"
)

type trustedHistoryRedisFake struct {
	enabled       bool
	incremented   bool
	counterKey    string
	cooldownKey   string
	counterTTL    time.Duration
	cooldown      time.Duration
}

func (f *trustedHistoryRedisFake) IsEnabled() bool { return f.enabled }
func (f *trustedHistoryRedisFake) GetInt(context.Context, string) (int64, error) { return 0, nil }
func (f *trustedHistoryRedisFake) Del(context.Context, string) error { return nil }
func (f *trustedHistoryRedisFake) IncrWithCooldown(_ context.Context, counterKey, cooldownKey string, counterTTL, cooldown time.Duration) (bool, error) {
	f.incremented = true
	f.counterKey = counterKey
	f.cooldownKey = cooldownKey
	f.counterTTL = counterTTL
	f.cooldown = cooldown
	return true, nil
}

func TestRecordCleanRequestUsesCooldown(t *testing.T) {
	redis := &trustedHistoryRedisFake{enabled: true}
	scorer := newTrustedHistoryScorer(nil, redis)

	scorer.RecordCleanRequest("1.2.3.4")

	if !redis.incremented {
		t.Fatal("clean request counter was not incremented")
	}
	if redis.counterKey != "th:1.2.3.4" {
		t.Fatalf("counter key = %q", redis.counterKey)
	}
	if redis.cooldownKey != "th:cooldown:1.2.3.4" {
		t.Fatalf("cooldown key = %q", redis.cooldownKey)
	}
	if redis.counterTTL != trustedHistoryTTL {
		t.Fatalf("counter TTL = %v", redis.counterTTL)
	}
	if redis.cooldown != trustedHistoryCooldown {
		t.Fatalf("cooldown = %v", redis.cooldown)
	}
}
