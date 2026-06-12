package metrics

import (
	"sync"
	"time"
)


type RequestMetrics struct {
	WallTime time.Duration
	CPUTime  time.Duration
	WaitTime time.Duration
	Timestamp time.Time
}


type PerformanceTracker struct {
	mu      sync.RWMutex
	metrics []RequestMetrics
	window  time.Duration
}


type Stats struct {
	P50LatencyMs     float64 `json:"p50_latency_ms"`
	P90LatencyMs     float64 `json:"p90_latency_ms"`
	P95LatencyMs     float64 `json:"p95_latency_ms"`
	P99LatencyMs     float64 `json:"p99_latency_ms"`
	AvgLatencyMs     float64 `json:"avg_latency_ms"`
	AvgPipelineMs    float64 `json:"avg_pipeline_ms"`
	AvgUpstreamMs    float64 `json:"avg_upstream_ms"`
	P50PipelineMs    float64 `json:"p50_pipeline_ms"`
	P95PipelineMs    float64 `json:"p95_pipeline_ms"`
	P99PipelineMs    float64 `json:"p99_pipeline_ms"`
	P50UpstreamMs    float64 `json:"p50_upstream_ms"`
	P95UpstreamMs    float64 `json:"p95_upstream_ms"`
	P99UpstreamMs    float64 `json:"p99_upstream_ms"`
	RequestCount     int     `json:"request_count"`
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
	defer pt.mu.RUnlock()

	if len(pt.metrics) == 0 {
		return Stats{}
	}


	cutoff := time.Now().Add(-pt.window)
	var validMetrics []RequestMetrics
	for _, m := range pt.metrics {
		if m.Timestamp.After(cutoff) {
			validMetrics = append(validMetrics, m)
		}
	}

	if len(validMetrics) == 0 {
		return Stats{}
	}


	latencies := make([]float64, len(validMetrics))
	pipelineLatencies := make([]float64, len(validMetrics))
	upstreamLatencies := make([]float64, len(validMetrics))
	var totalLatency, totalPipeline, totalUpstream float64

	for i, m := range validMetrics {
		latencyMs := float64(m.WallTime.Microseconds()) / 1000.0
		pipelineMs := float64(m.CPUTime.Microseconds()) / 1000.0
		upstreamMs := float64(m.WaitTime.Microseconds()) / 1000.0
		latencies[i] = latencyMs
		pipelineLatencies[i] = pipelineMs
		upstreamLatencies[i] = upstreamMs
		totalLatency += latencyMs
		totalPipeline += pipelineMs
		totalUpstream += upstreamMs
	}


	sortFloat64(latencies)
	sortFloat64(pipelineLatencies)
	sortFloat64(upstreamLatencies)

	n := float64(len(validMetrics))
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
		RequestCount:  len(validMetrics),
	}
}


func percentile(sorted []float64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}
	idx := int(float64(len(sorted)-1) * p)
	if idx < 0 {
		idx = 0
	}
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}


func sortFloat64(arr []float64) {
	n := len(arr)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if arr[j] > arr[j+1] {
				arr[j], arr[j+1] = arr[j+1], arr[j]
			}
		}
	}
}
