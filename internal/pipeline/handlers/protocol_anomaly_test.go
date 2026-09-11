package handlers

import (
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"unsafe"

	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/pipeline"
)

func newProtocolAnomalyTestHandler(rules map[string]int) *ProtocolAnomalyHandler {
	h := &ProtocolAnomalyHandler{
		appCfg: config.GetAppConfig(),
		stopCh: make(chan struct{}),
	}
	atomic.StorePointer(&h.state, unsafe.Pointer(&protocolAnomalyState{rules: rules}))
	return h
}

func newProtocolAnomalyTestContext(ua, ja4 string) *pipeline.Context {
	req := httptest.NewRequest("GET", "http://example.com/", nil)
	req.Header.Set("User-Agent", ua)
	if ja4 != "" {
		req.Header.Set("X-JA4", ja4)
	}
	return &pipeline.Context{
		Request:    req,
		Writer:     httptest.NewRecorder(),
		ClientIP:   "1.2.3.4",
		Normalized: pipeline.NormalizedRequest{UA: ua, Method: "GET", Path: "/"},
		RiskScore:  pipeline.NewRiskScore(),
	}
}

const (
	botUA     = "curl/8.0.1"
	browserUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"
	ja4OldTLS = "t10d1516h2_8daaf6152771_b186095e22b6"
	ja4NewTLS = "t13d1516h2_8daaf6152771_b186095e22b6"
)

func TestJA4TLSSegment(t *testing.T) {
	if got := ja4TLSSegment(ja4OldTLS); got != "10" {
		t.Fatalf("segment = %q, want \"10\"", got)
	}
	if got := ja4TLSSegment(ja4NewTLS); got != "13" {
		t.Fatalf("segment = %q, want \"13\"", got)
	}
	for _, short := range []string{"", "t", "t1"} {
		if got := ja4TLSSegment(short); got != "" {
			t.Fatalf("segment(%q) = %q, want empty", short, got)
		}
	}
}

func TestOldTLSScoredForNonBrowserUA(t *testing.T) {
	h := newProtocolAnomalyTestHandler(map[string]int{"ja4_old_tls": 15})
	ctx := newProtocolAnomalyTestContext(botUA, ja4OldTLS)

	score, _, _ := h.checkJA4Anomaly(ctx)

	if score != 15 {
		t.Fatalf("score = %d, want 15 from ja4_old_tls", score)
	}
}

func TestOldTLSUsesBrowserRuleForBrowserUA(t *testing.T) {
	h := newProtocolAnomalyTestHandler(map[string]int{
		"ja4_old_tls":            15,
		"ja4_old_tls_browser_ua": 7,
	})
	ctx := newProtocolAnomalyTestContext(browserUA, ja4OldTLS)

	score, _, _ := h.checkJA4Anomaly(ctx)

	if score != 7 {
		t.Fatalf("score = %d, want 7 from ja4_old_tls_browser_ua only", score)
	}
}

func TestModernTLSScoresNothingForOldTLSRules(t *testing.T) {
	h := newProtocolAnomalyTestHandler(map[string]int{
		"ja4_old_tls":            15,
		"ja4_old_tls_browser_ua": 15,
	})
	ctx := newProtocolAnomalyTestContext(botUA, ja4NewTLS)

	score, _, _ := h.checkJA4Anomaly(ctx)

	if score != 0 {
		t.Fatalf("score = %d, want 0 for TLS 1.3", score)
	}
}

func TestShortJA4DoesNotPanic(t *testing.T) {
	h := newProtocolAnomalyTestHandler(map[string]int{"ja4_old_tls": 15})
	ctx := newProtocolAnomalyTestContext(browserUA, "t1")

	if score, _, _ := h.checkJA4Anomaly(ctx); score != 0 {
		t.Fatalf("score = %d, want 0 for unparseable JA4", score)
	}
}
