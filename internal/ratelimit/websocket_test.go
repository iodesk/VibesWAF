package ratelimit

import "testing"

func TestWebSocketLimiterLimitsPerAppAndIP(t *testing.T) {
	limiter := NewWebSocketLimiter(func() (bool, int, int) { return true, 2, 60 })
	defer limiter.Stop()

	if !limiter.Allow("app-a", "1.2.3.4") {
		t.Fatal("first upgrade must be allowed")
	}
	if !limiter.Allow("app-a", "1.2.3.4") {
		t.Fatal("second upgrade must be allowed")
	}
	if limiter.Allow("app-a", "1.2.3.4") {
		t.Fatal("third upgrade must be rate limited")
	}
	if !limiter.Allow("app-b", "1.2.3.4") {
		t.Fatal("a different app must use an independent bucket")
	}
	if !limiter.Allow("app-a", "5.6.7.8") {
		t.Fatal("a different IP must use an independent bucket")
	}
}

func TestWebSocketLimiterFailsClosedForInvalidConfig(t *testing.T) {
	limiter := NewWebSocketLimiter(func() (bool, int, int) { return true, 0, 0 })
	defer limiter.Stop()

	if limiter.Allow("app", "1.2.3.4") {
		t.Fatal("invalid limiter configuration must not allow upgrades")
	}
}

func TestWebSocketLimiterFollowsDisabledConfig(t *testing.T) {
	limiter := NewWebSocketLimiter(func() (bool, int, int) { return false, 1, 60 })
	defer limiter.Stop()

	for i := 0; i < 5; i++ {
		if !limiter.Allow("app", "1.2.3.4") {
			t.Fatal("disabled rate limit config must not throttle upgrades")
		}
	}
}
