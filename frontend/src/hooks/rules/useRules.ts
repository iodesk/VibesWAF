import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wafApi } from '@/lib/api-client';
import type { RuleCreateRequest, RuleUpdateRequest, Rule } from '@/lib/api-client';

export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: () => wafApi.rules.list(),
  });
}

export function useRule(id: number) {
  return useQuery({
    queryKey: ['rules', id],
    queryFn: () => wafApi.rules.get(id),
    enabled: !!id,
  });
}

export function useCreateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RuleCreateRequest) => wafApi.rules.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      queryClient.invalidateQueries({ queryKey: ['ruleEvents'] });
    },
  });
}

export function useUpdateRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: RuleUpdateRequest }) =>
      wafApi.rules.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      queryClient.invalidateQueries({ queryKey: ['rules', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['ruleEvents'] });
    },
  });
}

export function useDeleteRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => wafApi.rules.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
      queryClient.invalidateQueries({ queryKey: ['ruleEvents'] });
    },
  });
}

export function useValidateExpression() {
  return useMutation({
    mutationFn: (expression: string) => wafApi.rules.validate(expression),
  });
}

export function useReorderRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ruleIDs: number[]) => wafApi.rules.reorder(ruleIDs),
    onMutate: async (ruleIDs) => {
      await queryClient.cancelQueries({ queryKey: ['rules'] });

      const previousRules = queryClient.getQueryData<Rule[]>(['rules']);

      if (previousRules) {
        const ruleMap = new Map(previousRules.map((r) => [r.id, r]));

        const newOptimisticRules = ruleIDs
          .map((id, index) => {
            const rule = ruleMap.get(id);
            if (rule) {
              return { ...rule, priority: (index + 1) * 10 };
            }
            return null;
          })
          .filter(Boolean) as Rule[];

        queryClient.setQueryData(['rules'], newOptimisticRules);
      }

      return { previousRules };
    },
    onError: (_err, _newTodo, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(['rules'], context.previousRules);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['rules'] });
    },
  });
}

export function useRuleEvents(days: number = 30) {
  return useQuery({
    queryKey: ['ruleEvents', days],
    queryFn: async () => {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3044';
      const response = await fetch(`${baseUrl}/api/v1/rules/events?days=${days}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch rule events');
      }
      return response.json() as Promise<Record<string, number>>;
    },
    refetchInterval: 30000,
  });
}
