import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wafApi } from '@/lib/api-client';
import type { BotPatternRequest } from '@/lib/api-client';

export function useBotPatterns() {
  return useQuery({
    queryKey: ['botPatterns'],
    queryFn: () => wafApi.botPatterns.list(),
  });
}

export function useCreateBotPattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BotPatternRequest) => wafApi.botPatterns.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botPatterns'] });
    },
  });
}

export function useUpdateBotPattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BotPatternRequest }) =>
      wafApi.botPatterns.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botPatterns'] });
    },
  });
}

export function useDeleteBotPattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => wafApi.botPatterns.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botPatterns'] });
    },
  });
}

export function useBulkDeleteBotPatterns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) => wafApi.botPatterns.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botPatterns'] });
    },
  });
}
