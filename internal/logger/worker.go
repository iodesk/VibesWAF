package logger

import (
	"context"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/iodesk/VibesWAF/internal/config"
	"github.com/iodesk/VibesWAF/internal/migration"
)

// reconnectInterval is the retry cadence while ClickHouse is down.
const reconnectInterval = 5 * time.Second

func (c *Clickhouse) worker() {
	batch := make([]LogEntry, 0, 1000)
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	retryTicker := time.NewTicker(reconnectInterval)
	defer retryTicker.Stop()

	for {
		select {
		case <-c.stopCh:
			// Drain remaining entries before exit
			for {
				select {
				case entry := <-c.ch:
					batch = append(batch, entry)
				default:
					if len(batch) > 0 {
						c.flush(batch)
					}
					return
				}
			}

		case entry := <-c.ch:
			batch = append(batch, entry)
			if len(batch) >= 1000 {
				c.flush(batch)
				batch = batch[:0]
			}

		case <-retryTicker.C:
			c.reconnectIfNeeded()

		case <-ticker.C:
			if len(batch) > 0 {
				c.flush(batch)
				batch = batch[:0]
			}
		}
	}
}

// reconnectIfNeeded re-establishes the ClickHouse connection when down.
// Called only from the worker goroutine.
func (c *Clickhouse) reconnectIfNeeded() {
	c.mu.Lock()
	if c.connected && c.conn != nil {
		c.mu.Unlock()
		return
	}
	if c.host == "" {
		c.mu.Unlock()
		return
	}
	closed := c.conn
	c.conn = nil
	c.mu.Unlock()

	if closed != nil {
		_ = closed.Close()
	}

	conn, err := c.open()
	if err != nil {
		config.GetAppConfig().LogWarn("[ClickHouse] reconnect failed: %v", err)
		return
	}

	c.mu.Lock()
	c.conn = conn
	c.connected = true
	c.mu.Unlock()
	config.GetAppConfig().LogInfo("[ClickHouse] Reconnected successfully")

	// Migration is idempotent (CREATE IF NOT EXISTS / ADD IF NOT EXISTS).
	appCfg := config.GetAppConfig()
	if err := migration.RunClickhouse(conn); err != nil {
		appCfg.LogWarn("[ClickHouse] Re-migration failed: %v", err)
	} else {
		appCfg.LogInfo("[ClickHouse] Migration re-check ok")
	}
}

func (c *Clickhouse) flush(batch []LogEntry) {
	c.mu.RLock()
	if !c.connected || c.conn == nil {
		c.mu.RUnlock()
		return
	}
	conn := c.conn
	c.mu.RUnlock()

	appCfg := config.GetAppConfig()
	appCfg.LogDebug("[ClickHouse] Flushing batch of %d entries", len(batch))

	ctx := context.Background()
	b, err := conn.PrepareBatch(ctx, `INSERT INTO waf_events (
		ts, ip, host, path, ua, action, reason, status,
		latency, pipeline_latency, upstream_latency,
		app_id, country, asn, asn_org, device_type, os, cache_hit, pipeline_trace
	)`)
	if err != nil {
		appCfg.LogError("[ClickHouse] prepare batch error: %v", err)
		c.markDisconnected()
		return
	}

	for _, entry := range batch {
		err = b.Append(
			entry.TS,
			entry.IP,
			entry.Host,
			entry.Path,
			entry.UA,
			entry.Action,
			entry.Reason,
			entry.Status,
			entry.Latency,
			entry.PipelineLatency,
			entry.UpstreamLatency,
			entry.AppID,
			entry.Country,
			entry.ASN,
			entry.ASNOrg,
			entry.DeviceType,
			entry.OS,
			entry.CacheHit,
			entry.PipelineTrace,
		)
		if err != nil {
			appCfg.LogError("[ClickHouse] append error: %v", err)
			continue
		}
	}

	if err := b.Send(); err != nil {
		appCfg.LogError("[ClickHouse] send batch error: %v", err)
		c.markDisconnected()
	} else {
		appCfg.LogDebug("[ClickHouse] Successfully flushed %d entries", len(batch))
	}
}

func (c *Clickhouse) markDisconnected() {
	c.mu.Lock()
	c.connected = false
	c.mu.Unlock()
}

func (c *Clickhouse) Connect(host, database, user, password string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.host = host
	c.database = database
	c.user = user
	c.password = password

	conn, err := c.open()
	if err != nil {
		return err
	}
	c.conn = conn
	c.connected = true
	config.GetAppConfig().LogInfo("[ClickHouse] Connected successfully")
	return nil
}

// open dials and pings a new ClickHouse connection. Does not touch c.conn.
func (c *Clickhouse) open() (driver.Conn, error) {
	conn, err := clickhouse.Open(&clickhouse.Options{
		Addr: []string{c.host},
		Auth: clickhouse.Auth{
			Database: c.database,
			Username: c.user,
			Password: c.password,
		},
		Settings: clickhouse.Settings{
			"max_execution_time": 60,
		},
		DialTimeout:     5 * time.Second,
		MaxOpenConns:    10,
		MaxIdleConns:    5,
		ConnMaxLifetime: 10 * time.Minute,
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		},
	})

	if err != nil {
		return nil, fmt.Errorf("clickhouse connect error: %w", err)
	}

	if err := conn.Ping(context.Background()); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("clickhouse ping error: %w", err)
	}

	return conn, nil
}

func (c *Clickhouse) Close() error {
	select {
	case <-c.stopCh:
	default:
		close(c.stopCh)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}