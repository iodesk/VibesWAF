package ratelimit

// WebSocketLimiterConfig supplies the upgrade budget from dashboard config.
// enabled=false means the operator disabled rate limiting entirely.
type WebSocketLimiterConfig func() (enabled bool, count int, duration int)

type WebSocketLimiter struct {
	limiter   *RateLimiter
	getConfig WebSocketLimiterConfig
}

func NewWebSocketLimiter(getConfig WebSocketLimiterConfig) *WebSocketLimiter {
	return &WebSocketLimiter{
		limiter:   NewRateLimiter(),
		getConfig: getConfig,
	}
}

func (l *WebSocketLimiter) Allow(appID, clientIP string) bool {
	if l == nil || l.limiter == nil || l.getConfig == nil {
		return false
	}

	enabled, count, duration := l.getConfig()
	if !enabled {
		return true
	}
	if count <= 0 || duration <= 0 {
		return false
	}

	return l.limiter.Allow(appID+":"+clientIP, count, float64(count)/float64(duration))
}

func (l *WebSocketLimiter) Stop() {
	if l != nil && l.limiter != nil {
		l.limiter.Stop()
	}
}
