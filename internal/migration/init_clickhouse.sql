-- Wafer WAF - ClickHouse Initialization
-- Table: waf_events (request logs, analytics)

CREATE TABLE IF NOT EXISTS waf_events (
    ts             DateTime64(3) DEFAULT now64(3),
    ip             String        DEFAULT '',
    host           String        DEFAULT '',
    path           String        DEFAULT '',
    ua             String        DEFAULT '',
    action         String        DEFAULT '',
    reason         String        DEFAULT '',
    status         UInt16        DEFAULT 0,
    latency        UInt32        DEFAULT 0,
    pipeline_latency UInt32      DEFAULT 0,
    upstream_latency UInt32      DEFAULT 0,
    app_id         String        DEFAULT '',
    country        String        DEFAULT '',
    asn            UInt32        DEFAULT 0,
    asn_org        String        DEFAULT '',
    device_type    String        DEFAULT '',
    os             String        DEFAULT '',
    cache_hit      Bool          DEFAULT false,
    pipeline_trace String        DEFAULT ''
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(ts)
ORDER BY (ts, app_id, action)
TTL toDateTime(ts) + INTERVAL 90 DAY
SETTINGS index_granularity = 8192;

-- Migration: add latency breakdown columns
ALTER TABLE waf_events ADD COLUMN IF NOT EXISTS pipeline_latency UInt32 DEFAULT 0;
ALTER TABLE waf_events ADD COLUMN IF NOT EXISTS upstream_latency UInt32 DEFAULT 0;
