package waf

import (
	"bytes"
	"io"
	"net/http/httptest"
	"os"
	"testing"
)

type nopAppConfig struct{}

func (nopAppConfig) LogInfo(string, ...interface{})  {}
func (nopAppConfig) LogDebug(string, ...interface{}) {}
func (nopAppConfig) LogError(string, ...interface{}) {}

// End-to-end check through real Coraza/CRS: a payload inside the inspected
// prefix must be detected, and the full body must remain readable afterwards so
// the proxy still forwards every byte.
func TestProcessRequestDetectsPayloadAndPreservesFullBody(t *testing.T) {
	cwd, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	if err := os.Chdir(t.TempDir()); err != nil {
		t.Fatalf("chdir: %v", err)
	}
	t.Cleanup(func() { _ = os.Chdir(cwd) })

	engine, err := NewCorazaEngine(1, 5, 4, []string{"GET", "POST"}, nil, "", nopAppConfig{})
	if err != nil {
		t.Fatalf("NewCorazaEngine: %v", err)
	}
	defer engine.Close()

	payload := []byte("id=1' OR '1'='1")
	tail := bytes.Repeat([]byte("z"), int(maxBodyInspectionBytes)+4096)
	full := append(append([]byte(nil), payload...), tail...)

	req := httptest.NewRequest("POST", "http://example.com/login", bytes.NewReader(full))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	result, err := engine.ProcessRequest(req, "1.2.3.4")
	if err != nil {
		t.Fatalf("ProcessRequest: %v", err)
	}
	if result.AnomalyScore == 0 {
		t.Fatal("SQLi payload in the inspected prefix was not detected")
	}

	proxied, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatalf("reading body after inspection: %v", err)
	}
	if !bytes.Equal(proxied, full) {
		t.Fatalf("proxied body truncated: %d of %d bytes", len(proxied), len(full))
	}
}

// A body larger than the inspection budget must not be buffered whole: the
// sampled prefix is bounded, proving the DoS vector is closed.
func TestBodyInspectionStaysWithinBudget(t *testing.T) {
	oversized := bytes.Repeat([]byte("z"), int(maxBodyInspectionBytes)*4)
	req := httptest.NewRequest("POST", "http://example.com/upload", bytes.NewReader(oversized))

	sampled := bufferBodyForInspection(req, maxBodyInspectionBytes)

	if int64(len(sampled)) != maxBodyInspectionBytes {
		t.Fatalf("sampled %d bytes, want exactly %d", len(sampled), maxBodyInspectionBytes)
	}
	if int64(len(sampled)) >= int64(len(oversized)) {
		t.Fatal("inspection buffered the entire oversized body")
	}
}
