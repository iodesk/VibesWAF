import { useQuery } from '@tanstack/react-query'
import { apiBase } from '@/lib/api-client'

export interface CacheHistoryPoint {
  label: string
  cache_hit: number
  cache_miss: number
  hit_rate: number
}

export interface CacheAnalytics {
  range: string
  data: CacheHistoryPoint[]
  summary: {
    total_hit: number
    total_miss: number
    hit_rate: number
  }
}

export function useCacheAnalytics(range: '1d' | '7d' | '30d') {
  return useQuery<CacheAnalytics>({
    queryKey: ['cache-analytics', range],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/api/v1/analytics/cache?range=${range}`, {
        credentials: 'include',
      })
      return res.json()
    },
    refetchInterval: 30000,
    staleTime: 25000,
  })
}
