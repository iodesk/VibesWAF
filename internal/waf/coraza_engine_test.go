package waf

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBufferBodyForInspectionBoundsMemoryAndPreservesBody(t *testing.T) {
	const limit = 64
	original := bytes.Repeat([]byte("A"), 500)
	req := httptest.NewRequest("POST", "http://example.com/", bytes.NewReader(original))

	sampled := bufferBodyForInspection(req, limit)

	if len(sampled) != limit {
		t.Fatalf("sampled %d bytes, want the memory bound of %d", len(sampled), limit)
	}
	replay, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatalf("reading rebuilt body: %v", err)
	}
	if !bytes.Equal(replay, original) {
		t.Fatalf("body was not forwarded intact: got %d bytes, want %d", len(replay), len(original))
	}
}

func TestBufferBodyForInspectionKeepsSmallBodyWhole(t *testing.T) {
	original := []byte("a=1&b=2")
	req := httptest.NewRequest("POST", "http://example.com/", bytes.NewReader(original))

	sampled := bufferBodyForInspection(req, 4096)

	if !bytes.Equal(sampled, original) {
		t.Fatalf("sampled = %q, want %q", sampled, original)
	}
	replay, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatalf("reading rebuilt body: %v", err)
	}
	if !bytes.Equal(replay, original) {
		t.Fatalf("body = %q, want %q", replay, original)
	}
}

func TestBufferBodyForInspectionIgnoresEmptyBody(t *testing.T) {
	req := httptest.NewRequest("GET", "http://example.com/", nil)

	if sampled := bufferBodyForInspection(req, 4096); len(sampled) != 0 {
		t.Fatalf("sampled = %q, want nothing for a bodyless request", sampled)
	}
}

func TestShouldInspectRequestBody(t *testing.T) {
	bodyless := httptest.NewRequest("GET", "http://example.com/", nil)
	if shouldInspectRequestBody(bodyless) {
		t.Fatal("bodyless request must not be inspected")
	}

	withBody := httptest.NewRequest("POST", "http://example.com/", bytes.NewReader([]byte("a=1")))
	if !shouldInspectRequestBody(withBody) {
		t.Fatal("request with body must be inspected")
	}

	// Chunked uploads report an unknown length (-1) and must still be inspected.
	chunked := &http.Request{Body: io.NopCloser(bytes.NewReader([]byte("a=1"))), ContentLength: -1}
	if !shouldInspectRequestBody(chunked) {
		t.Fatal("chunked request must be inspected")
	}
}
