import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wafApi } from '@/lib/api-client';
import type { BotConfig, WAFConfig, ScoringConfig, ProtocolAnomalyConfig } from '@/lib/api-client';

export function useBotConfig() {
  return useQuery({
    queryKey: ['botConfig'],
    queryFn: () => wafApi.settings.getBotConfig(),
  });
}

export function useUpdateBotConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BotConfig) => wafApi.settings.updateBotConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botConfig'] });
    },
  });
}

export function useWAFConfig() {
  return useQuery({
    queryKey: ['wafConfig'],
    queryFn: () => wafApi.settings.getWAFConfig(),
  });
}

export function useUpdateWAFConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WAFConfig) => wafApi.settings.updateWAFConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wafConfig'] });
    },
  });
}

export function useScoringConfig() {
  return useQuery({
    queryKey: ['scoringConfig'],
    queryFn: () => wafApi.settings.getScoringConfig(),
  });
}

export function useUpdateScoringConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ScoringConfig) => wafApi.settings.updateScoringConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scoringConfig'] });
    },
  });
}

export function useProtocolAnomalyConfig() {
  return useQuery({
    queryKey: ['protocolAnomalyConfig'],
    queryFn: () => wafApi.settings.getProtocolAnomalyConfig(),
  });
}

export function useUpdateProtocolAnomalyConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProtocolAnomalyConfig) => wafApi.settings.updateProtocolAnomalyConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['protocolAnomalyConfig'] });
    },
  });
}
