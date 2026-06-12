package bot

import (
	"crypto/sha1"
	"fmt"
	"net/http"
	"sort"
	"strings"
)

// GenerateFingerprint produces a SHA-1 hash of the most discriminating
// HTTP request headers. It is stored in ctx.HTTPFingerprint
// by the WAF handler so downstream scorers can use it without re-computing.
func GenerateFingerprint(r *http.Request) string {
	importantHeaders := []string{
		"Accept",
		"Accept-Encoding",
		"Accept-Language",
		"User-Agent",
		"Sec-Fetch-Site",
		"Sec-Fetch-Mode",
		"Sec-Fetch-Dest",
	}

	var parts []string
	for _, h := range importantHeaders {
		if val := r.Header.Get(h); val != "" {
			parts = append(parts, h+":"+val)
		}
	}

	sort.Strings(parts)
	combined := strings.Join(parts, "|")
	hash := sha1.Sum([]byte(combined)) //nolint:gosec
	return fmt.Sprintf("%x", hash)
}
