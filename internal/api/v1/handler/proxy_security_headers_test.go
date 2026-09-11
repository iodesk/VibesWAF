package handler

import (
	"crypto/tls"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"testing"

	"github.com/iodesk/VibesWAF/internal/domain/app"
)

type nopAppConfig struct{}

func (nopAppConfig) IsDebug() bool                   { return false }
func (nopAppConfig) LogDebug(string, ...interface{}) {}
func (nopAppConfig) LogInfo(string, ...interface{})  {}
func (nopAppConfig) LogWarn(string, ...interface{})  {}
func (nopAppConfig) LogError(string, ...interface{}) {}

func proxyTestUpstream(t *testing.T) app.Upstream {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// A legacy backend trying to weaken framing protection.
		w.Header().Set("X-Frame-Options", "ALLOWALL")
		w.Header().Set("Server", "legacy-app")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("upstream-body"))
	}))
	t.Cleanup(server.Close)

	parsed, err := url.Parse(server.URL)
	if err != nil {
		t.Fatalf("parse upstream url: %v", err)
	}
	host, portStr, err := net.SplitHostPort(parsed.Host)
	if err != nil {
		t.Fatalf("split host/port: %v", err)
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		t.Fatalf("parse port: %v", err)
	}

	return app.Upstream{Scheme: "http", Host: host, Port: port, Weight: 1, Enabled: true}
}

func TestProxyToUpstreamAppliesBaselineSecurityHeaders(t *testing.T) {
	h := &WAFHandler{appConfig: nopAppConfig{}}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "http://example.com/", nil)

	h.proxyToUpstream(rec, req, &app.App{}, proxyTestUpstream(t), "1.2.3.4")

	body, _ := io.ReadAll(rec.Result().Body)
	if string(body) != "upstream-body" {
		t.Fatalf("body = %q, want the upstream payload", body)
	}

	if got := rec.Header().Get("X-Frame-Options"); got != "SAMEORIGIN" {
		t.Fatalf("X-Frame-Options = %q, want SAMEORIGIN (upstream downgrade must not survive)", got)
	}
	if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("X-Content-Type-Options = %q, want nosniff", got)
	}
	if got := rec.Header().Get("Strict-Transport-Security"); got != "" {
		t.Fatalf("HSTS must not be set on a plain HTTP request, got %q", got)
	}
	if got := rec.Header().Get("Server"); got != "legacy-app" {
		t.Fatalf("unrelated upstream headers must pass through, got %q", got)
	}
}

func TestProxyToUpstreamAddsHSTSOnTLS(t *testing.T) {
	h := &WAFHandler{appConfig: nopAppConfig{}}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "https://example.com/", nil)
	req.TLS = &tls.ConnectionState{}

	h.proxyToUpstream(rec, req, nil, proxyTestUpstream(t), "1.2.3.4")

	if got := rec.Header().Get("Strict-Transport-Security"); got == "" {
		t.Fatal("HSTS must be present on a TLS request proxied through the WAF")
	}
}

func TestProxyToUpstreamPerAppHeaderOverridesBaseline(t *testing.T) {
	h := &WAFHandler{appConfig: nopAppConfig{}}
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

	h.proxyToUpstream(rec, req, application, proxyTestUpstream(t), "1.2.3.4")

	if got := rec.Header().Get("X-Frame-Options"); got != "DENY" {
		t.Fatalf("X-Frame-Options = %q, want the per-app override DENY", got)
	}
	if got := rec.Header().Get("Referrer-Policy"); got != "strict-origin-when-cross-origin" {
		t.Fatalf("Referrer-Policy = %q, want the baseline value", got)
	}
}
