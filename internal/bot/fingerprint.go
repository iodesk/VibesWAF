package bot

import (
	"fmt"
	"hash/fnv"
	"net/http"
)

var sortedHeaders = []string{
	"Accept",
	"Accept-Encoding",
	"Accept-Language",
	"Sec-Fetch-Dest",
	"Sec-Fetch-Mode",
	"Sec-Fetch-Site",
	"User-Agent",
}

var sep = []byte{'|'}
var colon = []byte{':'}

func GenerateFingerprint(r *http.Request) string {
	h := fnv.New64a()

	for _, name := range sortedHeaders {
		if val := r.Header.Get(name); val != "" {
			_, _ = h.Write([]byte(name))
			_, _ = h.Write(colon)
			_, _ = h.Write([]byte(val))
			_, _ = h.Write(sep)
		}
	}

	if ja4 := r.Header.Get("X-JA4"); ja4 != "" {
		_, _ = h.Write([]byte("ja4:"))
		_, _ = h.Write([]byte(ja4))
		_, _ = h.Write(sep)
	}
	if ja4h := r.Header.Get("X-JA4H"); ja4h != "" {
		_, _ = h.Write([]byte("ja4h:"))
		_, _ = h.Write([]byte(ja4h))
		_, _ = h.Write(sep)
	}

	_, _ = h.Write([]byte(fmt.Sprintf("http_version:%d.%d|", r.ProtoMajor, r.ProtoMinor)))

	if r.TLS != nil {
		_, _ = h.Write([]byte(fmt.Sprintf("tls_version:%d|", r.TLS.Version)))
		if r.TLS.NegotiatedProtocol != "" {
			_, _ = h.Write([]byte("alpn:"))
			_, _ = h.Write([]byte(r.TLS.NegotiatedProtocol))
			_, _ = h.Write(sep)
		}
	}

	return fmt.Sprintf("%016x", h.Sum64())
}
