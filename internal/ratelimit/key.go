package ratelimit

import (
    "crypto/sha1"
    "fmt"
)

func BuildKey(ip, ua string) string {
    h := sha1.Sum([]byte(ip + ua))
    return fmt.Sprintf("%x", h)
}
