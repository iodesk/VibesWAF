package metrics

import (
	"sort"
	"sync"
	"time"
)

type RequestMetrics struct {
	WallTime  time.Duration
	CPUTime   time.Duration
	WaitTime  time.Duration
	Timestamp time.Time
}

type PerformanceTracker struct {
	mu      sync.RWMutex
	metrics []RequestMetrics
	window  time.Duration
}

type Stats struct {
	P50LatencyMs  float64 `json:"p50_latency_ms"`
	P90LatencyMs  float64 `json:"p90_latency_ms"`
	P95LatencyMs  float64 `json:"p95_latency_ms"`
	P99LatencyMs  float64 `json:"p99_latency_ms"`
	AvgLatencyMs  float64 `json:"avg_latency_ms"`
	AvgPipelineMs float64 `json:"avg_pipeline_ms"`
	AvgUpstreamMs float64 `json:"avg_upstream_ms"`
	P50PipelineMs float64 `json:"p50_pipeline_ms"`
	P95PipelineMs float64 `json:"p95_pipeline_ms"`
	P99PipelineMs float64 `json:"p99_pipeline_ms"`
	P50UpstreamMs float64 `json:"p50_upstream_ms"`
	P95UpstreamMs float64 `json:"p95_upstream_ms"`
	P99UpstreamMs float64 `json:"p99_upstream_ms"`
	RequestCount  int     `json:"request_count"`
}

var globalTracker *PerformanceTracker

func init() {
	globalTracker = NewPerformanceTracker(5 * time.Minute)
}

func NewPerformanceTracker(window time.Duration) *PerformanceTracker {
	return &PerformanceTracker{
		metrics: make([]RequestMetrics, 0, 10000),
		window:  window,
	}
}

func Record(wallTime, cpuTime time.Duration) {
	globalTracker.Record(wallTime, cpuTime)
}

func GetStats() Stats {
	return globalTracker.GetStats()
}

func (pt *PerformanceTracker) Record(wallTime, cpuTime time.Duration) {
	pt.mu.Lock()
	defer pt.mu.Unlock()

	waitTime := wallTime - cpuTime
	if waitTime < 0 {
		waitTime = 0
	}

	metric := RequestMetrics{
		WallTime:  wallTime,
		CPUTime:   cpuTime,
		WaitTime:  waitTime,
		Timestamp: time.Now(),
	}

	pt.metrics = append(pt.metrics, metric)

	cutoff := time.Now().Add(-pt.window)
	validIdx := 0
	for i, m := range pt.metrics {
		if m.Timestamp.After(cutoff) {
			validIdx = i
			break
		}
	}
	if validIdx > 0 {
		pt.metrics = pt.metrics[validIdx:]
	}
}

func (pt *PerformanceTracker) GetStats() Stats {
	pt.mu.RLock()
	count := len(pt.metrics)
	if count == 0 {
		pt.mu.RUnlock()
		return Stats{}
	}

	// Copy metrics outside the lock so sorting does not block writers.
	cutoff := time.Now().Add(-pt.window)
	snapshot := make([]RequestMetrics, 0, count)
	for _, m := range pt.metrics {
		if m.Timestamp.After(cutoff) {
			snapshot = append(snapshot, m)
		}
	}
	pt.mu.RUnlock()

	if len(snapshot) == 0 {
		return Stats{}
	}

	latencies := make([]float64, len(snapshot))
	pipelineLatencies := make([]float64, len(snapshot))
	upstreamLatencies := make([]float64, len(snapshot))
	var totalLatency, totalPipeline, totalUpstream float64

	for i, m := range snapshot {
		// Nanoseconds avoids sub-microsecond truncation.
		latencyMs := float64(m.WallTime.Nanoseconds()) / 1_000_000.0
		pipelineMs := float64(m.CPUTime.Nanoseconds()) / 1_000_000.0
		upstreamMs := float64(m.WaitTime.Nanoseconds()) / 1_000_000.0
		latencies[i] = latencyMs
		pipelineLatencies[i] = pipelineMs
		upstreamLatencies[i] = upstreamMs
		totalLatency += latencyMs
		totalPipeline += pipelineMs
		totalUpstream += upstreamMs
	}

	sort.Float64s(latencies)
	sort.Float64s(pipelineLatencies)
	sort.Float64s(upstreamLatencies)

	n := float64(len(snapshot))
	return Stats{
		P50LatencyMs:  percentile(latencies, 0.50),
		P90LatencyMs:  percentile(latencies, 0.90),
		P95LatencyMs:  percentile(latencies, 0.95),
		P99LatencyMs:  percentile(latencies, 0.99),
		AvgLatencyMs:  totalLatency / n,
		AvgPipelineMs: totalPipeline / n,
		AvgUpstreamMs: totalUpstream / n,
		P50PipelineMs: percentile(pipelineLatencies, 0.50),
		P95PipelineMs: percentile(pipelineLatencies, 0.95),
		P99PipelineMs: percentile(pipelineLatencies, 0.99),
		P50UpstreamMs: percentile(upstreamLatencies, 0.50),
		P95UpstreamMs: percentile(upstreamLatencies, 0.95),
		P99UpstreamMs: percentile(upstreamLatencies, 0.99),
		RequestCount:  len(snapshot),
	}
}

// percentile returns the p-th percentile using the nearest-rank method.
// p must be in [0.0, 1.0]. For example, p=0.95 returns the value below
// which 95% of observations fall.
func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	// Nearest-rank: idx = ceil(N * p) - 1
	idx := int(float64(len(sorted))*p + 0.999999)
	switch {
	case idx < 0:
		return sorted[0]
	case idx >= len(sorted):
		return sorted[len(sorted)-1]
	}
	return sorted[idx]
}