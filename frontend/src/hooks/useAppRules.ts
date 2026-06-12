import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wafApi } from '@/lib/api-client';
import type { RuleCreateRequest, RuleUpdateRequest, Rule } from '@/lib/api-client';

const appRuleKeys = {
  byApp: (appId: string) => ['app-rules', appId] as const,
};

export function useAppRules(appId: string) {
  return useQuery({
    queryKey: appRuleKeys.byApp(appId),
    queryFn: () => wafApi.apps.listRules(appId),
    enabled: !!appId,
  });
}

export function useCreateAppRule(appId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RuleCreateRequest) => wafApi.apps.createRule(appId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appRuleKeys.byApp(appId) });
    },
  });
}

export function useUpdateAppRule(appId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RuleUpdateRequest }) =>
      wafApi.apps.updateRule(appId, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appRuleKeys.byApp(appId) });
    },
  });
}

export function useDeleteAppRule(appId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => wafApi.apps.deleteRule(appId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: appRuleKeys.byApp(appId) });
    },
  });
}

export function useReorderAppRules(appId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleIDs: number[]) => wafApi.apps.reorderRules(appId, ruleIDs),
    onMutate: async (ruleIDs) => {
      await queryClient.cancelQueries({ queryKey: appRuleKeys.byApp(appId) });

      const previousRules = queryClient.getQueryData<Rule[]>(appRuleKeys.byApp(appId));

      if (previousRules) {
        const ruleMap = new Map(previousRules.map((r) => [r.id, r]));

        const optimisticRules = ruleIDs
          .map((id, index) => {
            const rule = ruleMap.get(id);
            if (rule) {
              return { ...rule, priority: (index + 1) * 10 };
            }
            return null;
          })
          .filter(Boolean) as Rule[];

        queryClient.setQueryData(appRuleKeys.byApp(appId), optimisticRules);
      }

      return { previousRules };
    },
    onError: (_err, _ruleIDs, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(appRuleKeys.byApp(appId), context.previousRules);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: appRuleKeys.byApp(appId) });
    },
  });
}
