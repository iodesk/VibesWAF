package cache

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/iodesk/VibesWAF/internal/pipeline"
)

func TestDecisionCacheKeyUsesSHA256AndFieldBoundaries(t *testing.T) {
	cache := &DecisionCache{}
	first := &pipeline.Context{
		AppID:    "app",
		ClientIP: "1.2.3.4",
		Normalized: pipeline.NormalizedRequest{
			UA:     "ab",
			Method: "c",
			Path:   "/path",
			Query:  "x=1",
		},
	}
	second := &pipeline.Context{
		AppID:    "app",
		ClientIP: "1.2.3.4",
		Normalized: pipeline.NormalizedRequest{
			UA:     "a",
			Method: "bc",
			Path:   "/path",
			Query:  "x=1",
		},
	}

	firstKey := cache.generateKey(first)
	secondKey := cache.generateKey(second)
	if firstKey == secondKey {
		t.Fatal("cache key must preserve field boundaries")
	}
	if !strings.HasPrefix(firstKey, "waf:decision:v2:") {
		t.Fatalf("key prefix = %q, want versioned SHA-256 prefix", firstKey)
	}
	if len(strings.TrimPrefix(firstKey, "waf:decision:v2:")) != 64 {
		t.Fatalf("digest must contain 64 hexadecimal SHA-256 characters: %q", firstKey)
	}
}

func TestDecisionCacheKeyIsDeterministic(t *testing.T) {
	cache := &DecisionCache{}
	ctx := &pipeline.Context{
		Request:  httptest.NewRequest("GET", "http://example.com/path?x=1", nil),
		AppID:    "app",
		ClientIP: "1.2.3.4",
		Normalized: pipeline.NormalizedRequest{
			UA:     "ua",
			Method: "GET",
			Path:   "/path",
			Query:  "x=1",
		},
	}

	if got, want := cache.generateKey(ctx), cache.generateKey(ctx); got != want {
		t.Fatalf("generateKey is not deterministic: %q != %q", got, want)
	}
}
