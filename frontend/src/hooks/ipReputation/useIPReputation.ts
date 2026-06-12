import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wafApi } from '@/lib/api-client';
import type { IPReputationEntryRequest, IPReputationConfig } from '@/lib/api-client';

export function useIPReputationEntries() {
  return useQuery({
    queryKey: ['ipReputationEntries'],
    queryFn: () => wafApi.ipReputation.list(),
  });
}

export function useCreateIPReputationEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IPReputationEntryRequest) => wafApi.ipReputation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipReputationEntries'] });
    },
  });
}

export function useUpdateIPReputationEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: IPReputationEntryRequest }) =>
      wafApi.ipReputation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipReputationEntries'] });
    },
  });
}

export function useDeleteIPReputationEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => wafApi.ipReputation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipReputationEntries'] });
    },
  });
}

export function useBulkDeleteIPReputationEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: number[]) => wafApi.ipReputation.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipReputationEntries'] });
    },
  });
}

export function useBulkUpdateScoreIPReputationEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ids, score }: { ids: number[]; score: number }) => wafApi.ipReputation.bulkUpdateScore(ids, score),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipReputationEntries'] });
    },
  });
}

export function useIPReputationConfig() {
  return useQuery({
    queryKey: ['ipReputationConfig'],
    queryFn: () => wafApi.ipReputation.getConfig(),
  });
}

export function useUpdateIPReputationConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IPReputationConfig) => wafApi.ipReputation.updateConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipReputationConfig'] });
    },
  });
}

export function useSyncSpamhaus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => wafApi.ipReputation.syncSpamhaus(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ipReputationEntries'] });
    },
  });
}
