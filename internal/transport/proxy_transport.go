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

// Get returns a reusable transport for the given upstream key.
// insecure=true disables TLS verification (AllowInsecureSSL).
func (p *transportPool) Get(key string, insecure bool) *http.Transport {
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
	if insecure {
		t.TLSClientConfig = &tls.Config{InsecureSkipVerify: true} //nolint:gosec
	}
	p.transports[key] = t
	return t
}

// GetClient returns an *http.Client backed by a pooled transport.
// connectTimeout, readTimeout, sendTimeout are in seconds (0 = use default 5/60/60).
func GetClient(key string, insecure bool, connectTimeout, readTimeout, sendTimeout int) *http.Client {
	if connectTimeout <= 0 {
		connectTimeout = 5
	}
	if readTimeout <= 0 {
		readTimeout = 60
	}
	if sendTimeout <= 0 {
		sendTimeout = 60
	}

	totalTimeout := time.Duration(connectTimeout+readTimeout+sendTimeout) * time.Second

	return &http.Client{
		Transport: pool.Get(key, insecure),
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
