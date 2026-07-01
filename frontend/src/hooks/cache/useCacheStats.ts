import { useQuery } from '@tanstack/react-query'
import { apiBase } from '@/lib/api-client'

export interface HistoryPoint {
  time: string
  hit_rate: number
  hits: number
  misses: number
  block_hits: number
  challenge_hits: number
  avg_latency_ms: number
}

export interface CacheStats {
  hits: number
  misses: number
  hit_rate: number
  block_hits: number
  challenge_hits: number
  avg_latency_ms: number
  enabled: boolean
  history: HistoryPoint[]
}

export function useCacheStats() {
  return useQuery<CacheStats>({
    queryKey: ['cache-stats'],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/v1/cache/stats`, {
        credentials: 'include',
      })
      return res.json()
    },
    refetchInterval: 5000,
    staleTime: 4000,
  })
}
