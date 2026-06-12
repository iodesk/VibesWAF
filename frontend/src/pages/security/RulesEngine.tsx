import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRules, useUpdateRule, useDeleteRule, useReorderRules, useRuleEvents } from '@/hooks/useApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import { Plus, Search, FileCode, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Rule } from '@/lib/api-client';
import { SortableRuleRow } from '@/components/rules/SortableRuleRow';
import { RuleDeleteDialog } from '@/components/rules/RuleDeleteDialog';
import { IPAccessSection } from '@/components/ip-access/IPAccessSection';

export default function RulesEngine() {
  const navigate = useNavigate();
  const { data: rules, isLoading } = useRules();
  const { data: ruleEvents } = useRuleEvents(30);
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const reorderRules = useReorderRules();
  const { addToast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);

  const [actionFilter, setActionFilter] = useState<'all' | 'allow' | 'block' | 'challenge' | 'log' | 'skip'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleToggleEnabled = async (rule: Rule) => {
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        data: { ...rule, enabled: !rule.enabled },
      });
      addToast(`Rule ${!rule.enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (error: any) {
      addToast(error?.message || 'Failed to toggle rule', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedRule) return;
    try {
      await deleteRule.mutateAsync(selectedRule.id);
      addToast('Rule deleted successfully', 'success');
      setIsDeleteOpen(false);
      setSelectedRule(null);
    } catch (error: any) {
      addToast(error?.message || 'Failed to delete rule', 'error');
    }
  };

  const filteredRules = useMemo(() => {
    if (!rules) return [];
    return rules
      .filter((rule) => {
        if (actionFilter !== 'all' && rule.action !== actionFilter) return false;
        if (statusFilter === 'active' && !rule.enabled) return false;
        if (statusFilter === 'disabled' && rule.enabled) return false;
        if (
          searchQuery &&
          !rule.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !rule.expression_raw.toLowerCase().includes(searchQuery.toLowerCase())
        )
          return false;
        return true;
      })
      .sort((a, b) => a.priority - b.priority);
  }, [rules, actionFilter, statusFilter, searchQuery]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = filteredRules.findIndex((r) => r.id === active.id);
      const newIndex = filteredRules.findIndex((r) => r.id === over.id);
      const newOrder = arrayMove(filteredRules, oldIndex, newIndex);
      const ruleIDs = newOrder.map((r) => r.id);

      try {
        await reorderRules.mutateAsync(ruleIDs);
        addToast('Rules reordered successfully', 'success');
      } catch (error: any) {
        addToast(error?.message || 'Failed to reorder rules', 'error');
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse"></div>
          <div className="h-4 w-64 bg-muted/50 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-border rounded-lg p-4">
              <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2"></div>
              <div className="h-8 w-16 bg-muted/50 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
        <div className="border border-border rounded-lg p-6">
          <div className="space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 w-full bg-muted/50 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">Rules Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure security rules - First step in the request pipeline</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Rules</p>
                <div className="text-xl font-bold mt-1 text-foreground">{rules?.length || 0}</div>
              </div>
              <div className="p-2 rounded-md icon-container-primary">
                <FileCode className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Rules</p>
                <div className="text-xl font-bold mt-1 text-foreground">
                  {rules?.filter((r) => r.enabled).length || 0}
                </div>
              </div>
              <div className="p-2 rounded-md icon-container-success">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Hard Blocks</p>
                <div className="text-xl font-bold mt-1 text-foreground">
                  {rules?.filter((r) => r.action === 'block').length || 0}
                </div>
              </div>
              <div className="p-2 rounded-md icon-container-danger">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Next Priority</p>
                <div className="text-xl font-bold mt-1 text-foreground">
                  {rules && rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) + 10 : 10}
                </div>
              </div>
              <div className="p-2 rounded-md icon-container-primary">
                <Play className="w-5 h-5 rotate-90" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none border-border overflow-hidden">
        <CardContent className="p-4 bg-muted/30 border-b border-border">
          <div className="flex flex-col md:flex-row items-end gap-4">
            <div className="w-full flex-1 space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Search Rules</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Filter by name or expression..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs bg-background border-border focus:bg-background transition-colors"
                />
              </div>
            </div>
            <div className="w-full md:w-40 space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Action</Label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value as any)}
                className="flex h-9 w-full rounded-md border border-border bg-background text-foreground px-3 py-1 text-xs font-semibold focus:ring-1 focus:ring-ring outline-none"
              >
                <option value="all">All Actions</option>
                <option value="allow">Allow</option>
                <option value="block">Block</option>
                <option value="challenge">Challenge</option>
                <option value="log">Log Only</option>
                <option value="skip">Skip Modules</option>
              </select>
            </div>
            <div className="w-full md:w-40 space-y-1.5">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase">Status</Label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="flex h-9 w-full rounded-md border border-border bg-background text-foreground px-3 py-1 text-xs font-semibold focus:ring-1 focus:ring-ring outline-none"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
            <div className="md:w-auto">
              <Button
                onClick={() => navigate('/rules-engine/create')}
                className="btn-primary hover:opacity-90 shadow-none px-6 h-9 w-full md:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create
              </Button>
            </div>
          </div>
        </CardContent>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="w-full">
                <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
                  <tr>
                    <th className="w-10"></th>
                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6">Priority</th>
                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-48">Rule Name</th>
                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6">Expression</th>
                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-24">Events</th>
                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-32">Execution</th>
                    <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-32">Status</th>
                    <th className="text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <SortableContext
                    items={filteredRules.map((r) => r.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredRules.length > 0 ? (
                      filteredRules.map((rule) => (
                        <SortableRuleRow
                          key={rule.id}
                          rule={rule}
                          onToggle={handleToggleEnabled}
                          isReordering={reorderRules.isPending && reorderRules.variables?.includes(rule.id)}
                          triggerCount={ruleEvents?.[rule.id] ?? 0}
                          onDelete={(r: Rule) => {
                            setSelectedRule(r);
                            setIsDeleteOpen(true);
                          }}
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                              <AlertCircle className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">No rules found</p>
                              <p className="text-xs text-muted-foreground">Try adjusting your filters or create a new rule.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          </div>
        </CardContent>
      </Card>

      <IPAccessSection appId="default" />

      <RuleDeleteDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setSelectedRule(null);
        }}
        rule={selectedRule}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

