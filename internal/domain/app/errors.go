package app

import "errors"


var (
	ErrInvalidDomain          = errors.New("invalid domain")
	ErrInvalidRateLimit       = errors.New("invalid rate limit configuration")
	ErrInvalidFloodConfig     = errors.New("invalid flood protection configuration")
	ErrInvalidAction          = errors.New("invalid action")
	ErrInvalidChallengeType   = errors.New("invalid challenge type")
	ErrInvalidChallengeConfig = errors.New("invalid challenge configuration")
	ErrInvalidWAFThreshold    = errors.New("invalid WAF threshold")
	ErrAppNotFound            = errors.New("app not found")
)
