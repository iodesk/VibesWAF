package pipeline

import (
	"net/url"
	"strings"
)

// NormalizedRequest holds pre-normalized values derived from the raw HTTP
// request. Normalization happens exactly once per request, before any handler
// runs, so every layer sees the same canonical form.
//
// Rules:
//   - Path:   URL-decoded (single pass), null bytes stripped, lowercased
//   - Query:  URL-decoded (single pass), null bytes stripped, lowercased
//   - Host:   lowercased, port stripped
//   - UA:     null bytes stripped (case preserved — UA matching is case-insensitive at use-site)
//   - Method: uppercased
type NormalizedRequest struct {
	Path   string
	Query  string
	Host   string
	UA     string
	Method string
}

// Normalize builds a NormalizedRequest from the pipeline Context.
// It is called once by the pipeline orchestrator before handler execution.
func Normalize(ctx *Context) NormalizedRequest {
	r := ctx.Request

	path := normalizePath(r.URL.Path)
	query := normalizeQuery(r.URL.RawQuery)
	host := normalizeHost(r.Host)
	ua := stripNull(r.UserAgent())
	method := strings.ToUpper(r.Method)

	return NormalizedRequest{
		Path:   path,
		Query:  query,
		Host:   host,
		UA:     ua,
		Method: method,
	}
}

func normalizePath(raw string) string {
	decoded, err := url.PathUnescape(raw)
	if err != nil {
		decoded = raw
	}
	decoded = stripNull(decoded)
	return strings.ToLower(decoded)
}

func normalizeQuery(raw string) string {
	decoded, err := url.QueryUnescape(raw)
	if err != nil {
		decoded = raw
	}
	decoded = stripNull(decoded)
	return strings.ToLower(decoded)
}

func normalizeHost(host string) string {
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		host = host[:idx]
	}
	return strings.ToLower(host)
}

func stripNull(s string) string {
	return strings.ReplaceAll(s, "\x00", "")
}
