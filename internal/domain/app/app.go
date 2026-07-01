package app

import (
	"fmt"
	"net"
	"net/http"
	"hash/fnv"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

type Upstream struct {
	Scheme  string `json:"scheme"`
	Host    string `json:"host"`
	Port    int    `json:"port"`
	Weight  int    `json:"weight"`
	Enabled bool   `json:"enabled"`
	Healthy bool   `json:"healthy,omitempty"`
}

type AppConfig struct {
	Description string     `json:"description,omitempty"`
	Upstreams   []Upstream `json:"upstreams"`
	LBMethod    string     `json:"lb_method"`

	ListenPort int `json:"listen_port,omitempty"`


	RedirectHTTPS bool              `json:"redirect_https"`
	HealthCheck   HealthCheckConfig `json:"health_check"`

	Advanced AdvancedConfig `json:"advanced"`
}

type HealthCheckConfig struct {
	Enabled   bool   `json:"enabled"`
	Path      string `json:"path"`
	Interval  int    `json:"interval"`
	Threshold int    `json:"threshold"`
}


type ResponseHeader struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type AdvancedConfig struct {
	ListenIPv6 bool `json:"listen_ipv6"`

	AllowWebSocket bool `json:"allow_websocket"`

	ModifyHostHeader    bool   `json:"modify_host_header"`
	HostHeaderValue     string `json:"host_header_value"`
	PassXForwardedHost  bool   `json:"pass_x_forwarded_host"`
	PassXForwardedProto bool   `json:"pass_x_forwarded_proto"`

	AllowInsecureSSL bool `json:"allow_insecure_ssl"`

	TrustedProxies []string `json:"trusted_proxies,omitempty"`

	ConnectTimeout int `json:"connect_timeout"`
	ReadTimeout    int `json:"read_timeout"`
	SendTimeout    int `json:"send_timeout"`

	ProxyBuffering bool `json:"proxy_buffering"`

	AddHeaders []ResponseHeader `json:"add_headers,omitempty"`

	RequestSizeLimit int64 `json:"request_size_limit"`

	CORS CORSConfig `json:"cors"`

	Cache CacheConfig `json:"cache"`
}

type CORSConfig struct {
	Enabled        bool     `json:"enabled"`
	AllowOrigins   []string `json:"allow_origins,omitempty"`
	AllowMethods   []string `json:"allow_methods,omitempty"`
	AllowHeaders   []string `json:"allow_headers,omitempty"`
	ExposeHeaders  []string `json:"expose_headers,omitempty"`
	AllowCreds     bool     `json:"allow_credentials"`
	MaxAge         int      `json:"max_age"`
}

type CacheConfig struct {
	Enabled bool `json:"enabled"`
	TTL     int  `json:"ttl"`
}


// ExtractClientIP returns the real client IP by walking X-Forwarded-For
// from the rightmost untrusted proxy. If no trusted proxies are configured,
// it falls back to the leftmost X-Forwarded-For value (backward compatible).
func (a *App) ExtractClientIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff == "" {
		// CF-Connecting-IP is set by nginx after Cloudflare, which we trust.
		if cfIP := r.Header.Get("CF-Connecting-IP"); cfIP != "" {
			return strings.TrimSpace(cfIP)
		}
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			return r.RemoteAddr
		}
		return host
	}

	ips := strings.Split(xff, ",")
	trustedProxies := a.Config.Advanced.TrustedProxies

	if len(trustedProxies) == 0 {
		// No trusted proxy config: use leftmost (backward compatible with existing setup).
		return strings.TrimSpace(ips[0])
	}

	// Walk from right to left; rightmost non-trusted IP is the real client.
	for i := len(ips) - 1; i >= 0; i-- {
		ip := strings.TrimSpace(ips[i])
		trusted := false
		for _, cidr := range trustedProxies {
			_, network, err := net.ParseCIDR(cidr)
			if err != nil {
				continue
			}
			parsed := net.ParseIP(ip)
			if parsed != nil && network.Contains(parsed) {
				trusted = true
				break
			}
		}
		if !trusted {
			return ip
		}
	}

	// All IPs in the chain are trusted proxies; use leftmost as fallback.
	return strings.TrimSpace(ips[0])
}

// ExtractClientIPStatic is like ExtractClientIP but works with only trusted proxies list
// (no App needed — for call sites that may not have a resolved app yet).
func ExtractClientIPStatic(r *http.Request, trustedProxies []string) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff == "" {
		if cfIP := r.Header.Get("CF-Connecting-IP"); cfIP != "" {
			return strings.TrimSpace(cfIP)
		}
		host, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			return r.RemoteAddr
		}
		return host
	}

	ips := strings.Split(xff, ",")
	if len(trustedProxies) == 0 {
		return strings.TrimSpace(ips[0])
	}

	for i := len(ips) - 1; i >= 0; i-- {
		ip := strings.TrimSpace(ips[i])
		trusted := false
		for _, cidr := range trustedProxies {
			_, network, err := net.ParseCIDR(cidr)
			if err != nil {
				continue
			}
			parsed := net.ParseIP(ip)
			if parsed != nil && network.Contains(parsed) {
				trusted = true
				break
			}
		}
		if !trusted {
			return ip
		}
	}
	return strings.TrimSpace(ips[0])
}


func (a *App) PickUpstream(clientIP string) *Upstream {
	active := make([]Upstream, 0, len(a.Config.Upstreams))
	for _, u := range a.Config.Upstreams {
		if !u.Enabled {
			continue
		}
		// Skip unhealthy upstreams only when health check is configured.
		if a.Config.HealthCheck.Enabled && !u.Healthy {
			continue
		}
		active = append(active, u)
	}
	// Fallback: if all upstreams are unhealthy, use all enabled ones.
	if len(active) == 0 {
		for _, u := range a.Config.Upstreams {
			if u.Enabled {
				active = append(active, u)
			}
		}
	}
	if len(active) == 0 {
		return nil
	}
	if len(active) == 1 {
		return &active[0]
	}

	switch a.Config.LBMethod {
	case "least-conn":
		return a.pickLeastConn(active)
	case "ip-hash":
		return a.pickIPHash(active, clientIP)
	default:
		return a.pickRoundRobin(active)
	}
}

func (a *App) pickRoundRobin(upstreams []Upstream) *Upstream {
	val, _ := rrCounters.LoadOrStore(a.ID, new(uint64))
	counter := val.(*uint64)
	idx := atomic.AddUint64(counter, 1) % uint64(len(upstreams))
	return &upstreams[idx]
}

func (a *App) pickLeastConn(upstreams []Upstream) *Upstream {
	// TODO: track connection counts per upstream
	return &upstreams[0]
}

func (a *App) pickIPHash(upstreams []Upstream, clientIP string) *Upstream {
	h := fnv.New32a()
	h.Write([]byte(clientIP))
	idx := h.Sum32() % uint32(len(upstreams))
	return &upstreams[idx]
}
func (a *App) Validate() error {
	if a.Domain == "" {
		return ErrInvalidDomain
	}
	if strings.HasPrefix(a.Domain, "http://") || strings.HasPrefix(a.Domain, "https://") {
		return fmt.Errorf("domain must not include scheme (http:// or https://)")
	}
	if strings.ContainsAny(a.Domain, " \t\n") {
		return fmt.Errorf("domain must not contain spaces")
	}
	if len(a.Config.Upstreams) == 0 {
		return fmt.Errorf("at least one upstream is required")
	}

	for _, u := range a.Config.Upstreams {
		if u.Host == "" || u.Port <= 0 {
			return fmt.Errorf("invalid upstream host or port")
		}
		if u.Port > 65535 {
			return fmt.Errorf("upstream port must be between 1 and 65535")
		}
		if u.Scheme != "http" && u.Scheme != "https" && u.Scheme != "tcp" && u.Scheme != "udp" {
			return fmt.Errorf("invalid upstream scheme: %s", u.Scheme)
		}
		if u.Weight < 1 || u.Weight > 100 {
			return fmt.Errorf("upstream weight must be between 1 and 100")
		}
	}

	if a.IsStream() {
		minPort := StreamPortMin()
		maxPort := StreamPortMax()
		if a.Config.ListenPort != 0 && (a.Config.ListenPort < minPort || a.Config.ListenPort > maxPort) {
			return fmt.Errorf("listen_port must be between %d and %d", minPort, maxPort)
		}
	}

	activeCount := 0
	for _, u := range a.Config.Upstreams {
		if u.Enabled {
			activeCount++
		}
	}
	if activeCount == 0 {
		return fmt.Errorf("at least one upstream must be enabled")
	}

	if len(a.Config.Upstreams) > 1 {
		if a.Config.LBMethod != "round-robin" && a.Config.LBMethod != "least-conn" && a.Config.LBMethod != "ip-hash" {
			return fmt.Errorf("invalid load balancing method: %s", a.Config.LBMethod)
		}
	}

	adv := a.Config.Advanced
	if adv.ConnectTimeout < 0 || adv.ConnectTimeout > 300 {
		return fmt.Errorf("connect_timeout must be between 0 and 300")
	}
	if adv.ReadTimeout < 0 || adv.ReadTimeout > 600 {
		return fmt.Errorf("read_timeout must be between 0 and 600")
	}
	if adv.SendTimeout < 0 || adv.SendTimeout > 600 {
		return fmt.Errorf("send_timeout must be between 0 and 600")
	}
	for _, h := range adv.AddHeaders {
		if strings.TrimSpace(h.Name) == "" {
			return fmt.Errorf("response header name must not be empty")
		}
	}
	if adv.RequestSizeLimit < 0 {
		return fmt.Errorf("request_size_limit must be >= 0")
	}
	if adv.Cache.Enabled && adv.Cache.TTL <= 0 {
		return fmt.Errorf("cache ttl must be > 0 when cache is enabled")
	}
	if a.Config.HealthCheck.Enabled {
		if a.Config.HealthCheck.Path == "" {
			a.Config.HealthCheck.Path = "/health"
		}
		if a.Config.HealthCheck.Interval <= 0 {
			a.Config.HealthCheck.Interval = 30
		}
		if a.Config.HealthCheck.Threshold <= 0 {
			a.Config.HealthCheck.Threshold = 3
		}
	}

	return nil
}


type App struct {
	ID          string
	Domain      string
	Description string

	Config AppConfig

	UnderAttackMode bool

	CreatedAt time.Time
	UpdatedAt time.Time
}

// rrCounters holds per-app atomic round-robin counters (keyed by app ID).
var rrCounters sync.Map

func (a *App) IsStream() bool {
	if len(a.Config.Upstreams) == 0 {
		return false
	}
	scheme := a.Config.Upstreams[0].Scheme
	return scheme == "tcp" || scheme == "udp"
}

func (a *App) StreamScheme() string {
	if len(a.Config.Upstreams) == 0 {
		return ""
	}
	return a.Config.Upstreams[0].Scheme
}

func StreamPortMin() int {
	if val := os.Getenv("STREAM_PORT_MIN"); val != "" {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			return n
		}
	}
	return 10000
}

func StreamPortMax() int {
	if val := os.Getenv("STREAM_PORT_MAX"); val != "" {
		if n, err := strconv.Atoi(val); err == nil && n > 0 {
			return n
		}
	}
	return 19999
}
func DefaultAppConfig() AppConfig {
	return AppConfig{
		LBMethod: "round-robin",
		Upstreams: []Upstream{
			{
				Scheme:  "http",
				Host:    "localhost",
				Port:    8080,
				Weight:  1,
				Enabled: true,
			},
		},
		HealthCheck: HealthCheckConfig{
			Enabled:   false,
			Path:      "/health",
			Interval:  30,
			Threshold: 3,
		},
		Advanced: AdvancedConfig{
			ConnectTimeout: 30,
			ReadTimeout:    60,
			SendTimeout:    60,
			ProxyBuffering: true,
			CORS: CORSConfig{
				Enabled:      false,
				AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
				AllowHeaders: []string{"Content-Type", "Authorization"},
				MaxAge:       3600,
			},
			Cache: CacheConfig{
				Enabled: false,
				TTL:     300,
			},
		},
	}
}