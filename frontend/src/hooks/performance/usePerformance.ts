import { useQuery } from '@tanstack/react-query';

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
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3044';
      const response = await fetch(`${baseUrl}/api/v1/performance/stats`, {
        credentials: 'include',
      });
      return response.json();
    },
    refetchInterval: 5000,
    staleTime: 4000,
  });
}
