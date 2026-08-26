package logger

import (
	"sync"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type LogEntry struct {
	TS time.Time

	IP   string
	Host string
	Path string
	UA   string

	Action string
	Reason string

	Status          int
	Latency         int
	PipelineLatency int
	UpstreamLatency int

	AppID string

	Country string
	ASN     uint32
	ASNOrg  string

	DeviceType string
	OS         string

	CacheHit bool

	PipelineTrace string
}

type Clickhouse struct {
	ch     chan LogEntry
	stopCh chan struct{}

	mu        sync.RWMutex
	conn      driver.Conn
	connected bool

	host     string
	database string
	user     string
	password string
}

func NewClickhouse() *Clickhouse {
	c := &Clickhouse{
		ch:     make(chan LogEntry, 10000),
		stopCh: make(chan struct{}),
	}
	go c.worker()
	return c
}

func (c *Clickhouse) IsConnected() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.connected && c.conn != nil
}

func (c *Clickhouse) Log(entry LogEntry) {
	select {
	case c.ch <- entry:
	default:
	}
}

func (c *Clickhouse) Conn() driver.Conn {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.conn
}