import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wafApi } from '@/lib/api-client';
import type { BotIPRangeRequest } from '@/lib/api-client';

export function useBotIPRanges() {
  return useQuery({
    queryKey: ['botIPRanges'],
    queryFn: () => wafApi.botIPRanges.list(),
  });
}

export function useCreateBotIPRange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BotIPRangeRequest) => wafApi.botIPRanges.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botIPRanges'] });
    },
  });
}

export function useUpdateBotIPRange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: BotIPRangeRequest }) =>
      wafApi.botIPRanges.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botIPRanges'] });
    },
  });
}

export function useDeleteBotIPRange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => wafApi.botIPRanges.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botIPRanges'] });
    },
  });
}

export function useSyncBotIPRange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => wafApi.botIPRanges.sync(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botIPRanges'] });
    },
  });
}
