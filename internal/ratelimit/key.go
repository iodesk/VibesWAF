package ratelimit

import (
	"crypto/sha1"
	"fmt"
	"hash/fnv"
)

func BuildKey(ip, ua string) string {
	h := sha1.Sum([]byte(ip + ua))
	return fmt.Sprintf("%x", h)
}

func GenerateKey(ip, userAgent string) string {
	h := fnv.New64a()
	_, _ = h.Write([]byte(userAgent))
	uaHash := fmt.Sprintf("%016x", h.Sum64())
	return fmt.Sprintf("%s:%s", ip, uaHash)
}
