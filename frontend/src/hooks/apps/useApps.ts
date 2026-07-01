import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wafApi, apiBase } from '@/lib/api-client';
import type { AppCreateRequest, AppUpdateRequest, AppStats } from '@/lib/api-client';

export function useApps() {
  return useQuery({
    queryKey: ['apps'],
    queryFn: () => wafApi.apps.list(),
  });
}

export function useApp(id: string) {
  return useQuery({
    queryKey: ['apps', id],
    queryFn: () => wafApi.apps.get(id),
    enabled: !!id,
  });
}

export function useCreateApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AppCreateRequest) => wafApi.apps.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}

export function useUpdateApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AppUpdateRequest }) =>
      wafApi.apps.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
      queryClient.invalidateQueries({ queryKey: ['apps', variables.id] });
    },
  });
}

export function useDeleteApp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => wafApi.apps.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}

export function useToggleUnderAttackMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ appId, enabled }: { appId: string; enabled: boolean }) =>
      wafApi.apps.toggleUnderAttackMode(appId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] });
    },
  });
}

export function useAppStats(appId: string) {
  return useQuery({
    queryKey: ['app-stats', appId],
    queryFn: async () => {
      const response = await fetch(`${apiBase}/api/v1/apps/${appId}/stats`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch app stats');
      }
      return response.json() as Promise<AppStats>;
    },
    refetchInterval: 30000,
  });
}
