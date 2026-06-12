package logger

import (
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
	conn   driver.Conn
	stopCh chan struct{}
}

func NewClickhouse() *Clickhouse {
	c := &Clickhouse{
		ch:     make(chan LogEntry, 10000),
		stopCh: make(chan struct{}),
	}
	go c.worker()
	return c
}

func (c *Clickhouse) Log(entry LogEntry) {
	select {
	case c.ch <- entry:
	default:
	}
}

func (c *Clickhouse) Conn() driver.Conn {
	return c.conn
}
