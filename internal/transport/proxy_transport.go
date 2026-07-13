package transport

import (
	"crypto/tls"
	"net/http"
	"sync"
	"time"
)

// transportPool reuses http.Transport per upstream key (scheme+host+port).
// This enables TCP keep-alive and connection pooling across requests.
type transportPool struct {
	mu         sync.RWMutex
	transports map[string]*http.Transport
}

var pool = &transportPool{
	transports: make(map[string]*http.Transport),
}

// Get returns a reusable transport for the given key.
// insecure=true disables TLS verification (AllowInsecureSSL).
// sni sets TLS ServerName (SNI); empty = use hostname from URL.
func (p *transportPool) Get(key string, insecure bool, sni string) *http.Transport {
	p.mu.RLock()
	t, ok := p.transports[key]
	p.mu.RUnlock()
	if ok {
		return t
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	if t, ok = p.transports[key]; ok {
		return t
	}

	t = &http.Transport{
		MaxIdleConns:        256,
		MaxIdleConnsPerHost: 64,
		IdleConnTimeout:     90 * time.Second,
		DisableKeepAlives:   false,
		ForceAttemptHTTP2:   true,
	}
	if insecure || sni != "" {
		t.TLSClientConfig = &tls.Config{}
		if insecure {
			t.TLSClientConfig.InsecureSkipVerify = true //nolint:gosec
		}
		if sni != "" {
			t.TLSClientConfig.ServerName = sni
		}
	}
	p.transports[key] = t
	return t
}

// GetClient returns an *http.Client backed by a pooled transport.
// connectTimeout, readTimeout, sendTimeout are in seconds (0 = use default 5/60/60).
// sni overrides TLS ServerName (SNI); empty = use hostname from URL.
func GetClient(key string, insecure bool, sni string, connectTimeout, readTimeout, sendTimeout int) *http.Client {
	if connectTimeout <= 0 {
		connectTimeout = 5
	}
	if readTimeout <= 0 {
		readTimeout = 60
	}
	if sendTimeout <= 0 {
		sendTimeout = 60
	}

	// Include sni in pool key so transports with different SNI are not shared.
	poolKey := key
	if sni != "" {
		poolKey += "|sni=" + sni
	}

	totalTimeout := time.Duration(connectTimeout+readTimeout+sendTimeout) * time.Second

	return &http.Client{
		Transport: pool.Get(poolKey, insecure, sni),
		Timeout:   totalTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

// bufferPool reuses 32KB copy buffers for proxy body streaming, avoiding a
// fresh allocation per request (io.Copy allocates 32KB each call otherwise).
var bufferPool = sync.Pool{
	New: func() interface{} {
		b := make([]byte, 32*1024)
		return &b
	},
}

// GetBuffer borrows a copy buffer from the pool.
func GetBuffer() *[]byte {
	return bufferPool.Get().(*[]byte)
}

// PutBuffer returns a copy buffer to the pool.
func PutBuffer(b *[]byte) {
	bufferPool.Put(b)
}
