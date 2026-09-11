package handler

import (
	"net/http"

	"github.com/iodesk/VibesWAF/internal/domain/app"
)

// hstsHeaderValue keeps HSTS free of includeSubDomains/preload so a proxied
// application is not silently committed to HTTPS on unrelated subdomains.
const hstsHeaderValue = "max-age=31536000"

// defaultSecurityHeaders are applied to every proxied response as a baseline of
// hardening. A header already produced by the application configuration
// (Advanced.AddHeaders) overrides the matching baseline entry.
//
// Content-Security-Policy, Cross-Origin-Opener-Policy and Permissions-Policy are
// deliberately absent: a safe value for them is application specific (CSP breaks
// inline scripts, COOP breaks popup-based OAuth, Permissions-Policy can disable
// camera/microphone). Configure those per app via Advanced.AddHeaders.
var defaultSecurityHeaders = []app.ResponseHeader{
	{Name: "X-Content-Type-Options", Value: "nosniff"},
	{Name: "X-Frame-Options", Value: "SAMEORIGIN"},
	{Name: "Referrer-Policy", Value: "strict-origin-when-cross-origin"},
}

// applySecurityHeaders writes the baseline hardening headers on a proxied
// response. Values coming from the upstream are replaced so a misconfigured or
// legacy backend cannot downgrade them; per-app AddHeaders run afterwards and
// win. HSTS is only emitted for TLS requests, as required by RFC 6797.
func applySecurityHeaders(w http.ResponseWriter, r *http.Request) {
	header := w.Header()
	for _, h := range defaultSecurityHeaders {
		header.Set(h.Name, h.Value)
	}
	if r.TLS != nil {
		header.Set("Strict-Transport-Security", hstsHeaderValue)
	} else {
		header.Del("Strict-Transport-Security")
	}
}

// applyAppResponseHeaders applies the per-application response header overrides.
func applyAppResponseHeaders(w http.ResponseWriter, application *app.App) {
	if application == nil {
		return
	}
	for _, h := range application.Config.Advanced.AddHeaders {
		if h.Name != "" {
			w.Header().Set(h.Name, h.Value)
		}
	}
}
