import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wafApi } from '@/lib/api-client';
import type { RateLimitUpdateRequest } from '@/lib/api-client';

export function useRateLimit() {
  return useQuery({
    queryKey: ['rateLimit'],
    queryFn: () => wafApi.rateLimit.get(),
  });
}

export function useRateLimitStats() {
  return useQuery({
    queryKey: ['rateLimitStats'],
    queryFn: () => wafApi.rateLimit.getStats(),
    refetchInterval: 30_000,
  });
}

export function useUpdateRateLimit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RateLimitUpdateRequest) => wafApi.rateLimit.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rateLimit'] });
    },
  });
}
