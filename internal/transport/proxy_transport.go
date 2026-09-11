package transport

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"
)

// Default timeouts when DB value is 0 / unset.
const (
	defaultConnectTimeout = 5
	defaultReadTimeout    = 60
	defaultSendTimeout    = 60
)

// transportPool reuses http.Transport per upstream key (scheme+host+port+timeouts).
// This enables TCP keep-alive and connection pooling across requests.
// Timeouts are part of the pool key so different timeout configs get isolated pools.
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
// connect/read/send in seconds — applied as per-phase Transport timeouts.
func (p *transportPool) Get(key string, insecure bool, sni string, connectTimeout, readTimeout int) *http.Transport {
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

	dialer := &net.Dialer{
		Timeout:   time.Duration(connectTimeout) * time.Second,
		KeepAlive: 30 * time.Second,
	}

	t = &http.Transport{
		DialContext:           dialer.DialContext,
		TLSHandshakeTimeout:  time.Duration(connectTimeout) * time.Second,
		ResponseHeaderTimeout: time.Duration(readTimeout) * time.Second,
		MaxIdleConns:          256,
		MaxIdleConnsPerHost:   64,
		IdleConnTimeout:       90 * time.Second,
		DisableKeepAlives:     false,
		ForceAttemptHTTP2:     true,
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
// Per-phase timeouts enforced via Transport fields (DialContext, TLSHandshakeTimeout,
// ResponseHeaderTimeout). http.Client.Timeout serves as the overall deadline.
// sni overrides TLS ServerName (SNI); empty = use hostname from URL.
func GetClient(key string, insecure bool, sni string, connectTimeout, readTimeout, sendTimeout int) *http.Client {
	if connectTimeout <= 0 {
		connectTimeout = defaultConnectTimeout
	}
	if readTimeout <= 0 {
		readTimeout = defaultReadTimeout
	}
	if sendTimeout <= 0 {
		sendTimeout = defaultSendTimeout
	}

	// Include sni and timeouts in pool key — different timeout configs for the
	// same upstream must not share a transport (per-phase timeouts are set on
	// the Transport, not per-request).
	poolKey := key
	if sni != "" {
		poolKey += "|sni=" + sni
	}
	poolKey += fmt.Sprintf("|%d|%d|%d", connectTimeout, readTimeout, sendTimeout)

	transport := pool.Get(poolKey, insecure, sni, connectTimeout, readTimeout)

	// Overall deadline: connect + max(read, send). This covers body streaming
	// which has no Transport-level timeout in Go's stdlib.
	totalTimeout := time.Duration(connectTimeout+max(readTimeout, sendTimeout)) * time.Second

	return &http.Client{
		Transport: transport,
		Timeout:   totalTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
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
