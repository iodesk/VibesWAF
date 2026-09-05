import { useQuery } from '@tanstack/react-query';
import { wafApi } from '@/lib/api-client';

type ShortRange = '1d' | '7d' | '30d'
type FullRange = '5min' | '15min' | '1h' | '1d' | '7d' | '30d'

export function useTrafficAnalytics(range: ShortRange, appId?: string) {
  return useQuery({
    queryKey: ['analytics', 'traffic', range, appId],
    queryFn: () => wafApi.analytics.getTrafficAnalytics({ range, app_id: appId }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useTopThreats(range: FullRange, appId?: string) {
  return useQuery({
    queryKey: ['analytics', 'threats', range, appId],
    queryFn: () => wafApi.analytics.getTopThreats(range, appId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useDashboardInsights(range: FullRange, appId?: string) {
  return useQuery({
    queryKey: ['analytics', 'insights', range, appId],
    queryFn: () => wafApi.analytics.getInsights(range, appId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useChallengeStats(range: ShortRange) {
  return useQuery({
    queryKey: ['analytics', 'challenge-stats', range],
    queryFn: () => wafApi.analytics.getChallengeStats(range),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useTopBlockedBots(range: FullRange = '7d') {
  return useQuery({
    queryKey: ['analytics', 'top-blocked-bots', range],
    queryFn: () => wafApi.analytics.getTopBlockedBots(range),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useWAFStats(range: ShortRange) {
  return useQuery({
    queryKey: ['analytics', 'waf-stats', range],
    queryFn: () => wafApi.analytics.getWAFStats(range),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
export function useJA4Fingerprints(limit: number = 100, offset: number = 0) {
  return useQuery({
    queryKey: ['analytics', 'fingerprints', limit, offset],
    queryFn: () => wafApi.analytics.getJA4Fingerprints(limit, offset),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useJA4Detail(ja4: string | null) {
  return useQuery({
    queryKey: ['analytics', 'fingerprint-detail', ja4],
    queryFn: () => wafApi.analytics.getJA4Detail(ja4!),
    enabled: !!ja4,
    staleTime: 60_000,
  });
}
