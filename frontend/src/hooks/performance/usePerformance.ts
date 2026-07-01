import { useQuery } from '@tanstack/react-query';
import { apiBase } from '@/lib/api-client';

export interface PerformanceStats {
  p50_latency_ms: number;
  p90_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  avg_latency_ms: number;
  avg_pipeline_ms: number;
  avg_upstream_ms: number;
  p50_pipeline_ms: number;
  p95_pipeline_ms: number;
  p99_pipeline_ms: number;
  p50_upstream_ms: number;
  p95_upstream_ms: number;
  p99_upstream_ms: number;
  request_count: number;
}

export function usePerformanceStats() {
  return useQuery<PerformanceStats>({
    queryKey: ['performance-stats'],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/v1/performance/stats`, {
        credentials: 'include',
      });
      return response.json();
    },
    refetchInterval: 5000,
    staleTime: 4000,
  });
}
