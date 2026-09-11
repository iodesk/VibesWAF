package handler

import (
	"crypto/tls"
	"net/http/httptest"
	"testing"

	"github.com/iodesk/VibesWAF/internal/domain/app"
)

func TestApplySecurityHeadersSetsBaseline(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "http://example.com/", nil)

	applySecurityHeaders(rec, req)

	for name, want := range map[string]string{
		"X-Content-Type-Options":    "nosniff",
		"X-Frame-Options":           "SAMEORIGIN",
		"Referrer-Policy":           "strict-origin-when-cross-origin",
		"Strict-Transport-Security": "",
	} {
		if got := rec.Header().Get(name); got != want {
			t.Fatalf("%s = %q, want %q", name, got, want)
		}
	}

	// Application-specific policies must not be guessed by the WAF.
	for _, name := range []string{
		"Content-Security-Policy",
		"Cross-Origin-Opener-Policy",
		"Permissions-Policy",
	} {
		if got := rec.Header().Get(name); got != "" {
			t.Fatalf("%s = %q, want the WAF to leave app-specific policies unset", name, got)
		}
	}
}

func TestApplySecurityHeadersAddsHSTSOnlyOnTLS(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "https://example.com/", nil)
	req.TLS = &tls.ConnectionState{}

	applySecurityHeaders(rec, req)

	if got := rec.Header().Get("Strict-Transport-Security"); got == "" {
		t.Fatal("HSTS must be present on TLS responses")
	}
}

func TestApplySecurityHeadersOverridesUpstreamValues(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "http://example.com/", nil)
	rec.Header().Set("X-Frame-Options", "ALLOWALL")

	applySecurityHeaders(rec, req)

	if got := rec.Header().Get("X-Frame-Options"); got != "SAMEORIGIN" {
		t.Fatalf("X-Frame-Options = %q, want the WAF baseline", got)
	}
}

func TestPerAppHeadersOverrideBaseline(t *testing.T) {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "http://example.com/", nil)
	application := &app.App{
		Config: app.AppConfig{
			Advanced: app.AdvancedConfig{
				AddHeaders: []app.ResponseHeader{
					{Name: "X-Frame-Options", Value: "DENY"},
				},
			},
		},
	}

	applySecurityHeaders(rec, req)
	applyAppResponseHeaders(rec, application)

	if got := rec.Header().Get("X-Frame-Options"); got != "DENY" {
		t.Fatalf("X-Frame-Options = %q, want per-app override DENY", got)
	}
	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("baseline headers must survive app overrides, got %q", got)
	}
}

func TestPerAppHeadersIgnoredWithoutApp(t *testing.T) {
	rec := httptest.NewRecorder()

	applyAppResponseHeaders(rec, nil)

	if len(rec.Header()) != 0 {
		t.Fatalf("nil app must not write headers, got %v", rec.Header())
	}
}
