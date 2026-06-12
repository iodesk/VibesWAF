import { useQuery } from '@tanstack/react-query';
import { wafApi } from '@/lib/api-client';

export function useThreatIPs(range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d', appId?: string) {
  return useQuery({
    queryKey: ['analytics', 'threat-intel', 'ips', range, appId],
    queryFn: () => wafApi.analytics.getThreatIPs(range, appId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useWAFRuleIntel(range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d', appId?: string) {
  return useQuery({
    queryKey: ['analytics', 'threat-intel', 'waf-rules', range, appId],
    queryFn: () => wafApi.analytics.getWAFRuleIntel(range, appId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useThreatSummary(range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d', appId?: string) {
  return useQuery({
    queryKey: ['analytics', 'threat-intel', 'summary', range, appId],
    queryFn: () => wafApi.analytics.getThreatSummary(range, appId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCustomRuleIntel(range: '5min' | '15min' | '1h' | '1d' | '7d' | '30d', appId?: string) {
  return useQuery({
    queryKey: ['analytics', 'threat-intel', 'custom-rules', range, appId],
    queryFn: () => wafApi.analytics.getCustomRuleIntel(range, appId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
