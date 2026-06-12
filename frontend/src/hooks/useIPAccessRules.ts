import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wafApi } from '@/lib/api-client';
import type { IPAccessRuleCreateRequest, IPAccessRuleUpdateRequest } from '@/lib/api-client';

const ipAccessKeys = {
  byApp: (appId: string) => ['ip-access-rules', appId] as const,
};

export function useIPAccessRules(appId: string) {
  return useQuery({
    queryKey: ipAccessKeys.byApp(appId),
    queryFn: async () => {
      const response = await wafApi.apps.listIPAccessRules(appId);
      return response.rules;
    },
    enabled: !!appId,
  });
}

export function useCreateIPAccessRule(appId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: IPAccessRuleCreateRequest) => wafApi.apps.createIPAccessRule(appId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ipAccessKeys.byApp(appId) });
    },
  });
}

export function useUpdateIPAccessRule(appId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: IPAccessRuleUpdateRequest }) =>
      wafApi.apps.updateIPAccessRule(appId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ipAccessKeys.byApp(appId) });
    },
  });
}

export function useDeleteIPAccessRule(appId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => wafApi.apps.deleteIPAccessRule(appId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ipAccessKeys.byApp(appId) });
    },
  });
}
