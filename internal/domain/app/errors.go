package app

import "errors"


var (
	ErrInvalidDomain = errors.New("invalid domain")
	ErrAppNotFound   = errors.New("app not found")
)