package pipeline

import (
	"net/http/httptest"
	"testing"
)

func TestNormalize(t *testing.T) {
	req := httptest.NewRequest("get", "http://Example.COM:8443/API/Users?Name=Foo", nil)
	req.Host = "Example.COM:8443"
	req.Header.Set("User-Agent", "Mozilla/5.0")

	ctx := &Context{Request: req}
	n := Normalize(ctx)

	if n.Method != "GET" {
		t.Errorf("Method = %q, want GET", n.Method)
	}
	if n.Host != "example.com" {
		t.Errorf("Host = %q, want example.com (lowercased, port stripped)", n.Host)
	}
	if n.Path != "/api/users" {
		t.Errorf("Path = %q, want /api/users (lowercased)", n.Path)
	}
	if n.Query != "name=foo" {
		t.Errorf("Query = %q, want name=foo (decoded, lowercased)", n.Query)
	}
	if n.UA != "Mozilla/5.0" {
		t.Errorf("UA = %q, want case-preserved Mozilla/5.0", n.UA)
	}
}

func TestNormalizeStripsNullBytes(t *testing.T) {
	req := httptest.NewRequest("GET", "http://example.com/a%00b", nil)
	req.Host = "example.com"
	req.Header.Set("User-Agent", "bad\x00ua")

	ctx := &Context{Request: req}
	n := Normalize(ctx)

	if n.Path != "/ab" {
		t.Errorf("Path = %q, want /ab (null stripped after decode)", n.Path)
	}
	if n.UA != "badua" {
		t.Errorf("UA = %q, want badua (null stripped)", n.UA)
	}
}

func TestNormalizeHostNoPort(t *testing.T) {
	if got := normalizeHost("HOST.local"); got != "host.local" {
		t.Errorf("normalizeHost = %q, want host.local", got)
	}
}
