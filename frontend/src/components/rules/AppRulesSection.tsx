import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import {
  Plus,
  AlertCircle,
  Wand2,
  Code,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  Save,
} from 'lucide-react';
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
import { RuleDeleteDialog } from '@/components/rules/RuleDeleteDialog';
import { AppRuleRow } from '@/components/rules/AppRuleRow';
import { ExpressionBuilder, generateExpression, type ConditionGroup } from '@/components/rules/ExpressionBuilder';
import { astToConditionGroup } from '@/lib/ast-converter';
import { fetchFieldMetadata, type FieldDefinition } from '@/lib/field-metadata';
import { useValidateExpression, useRuleEvents } from '@/hooks/rules/useRules';
import {
  useAppRules,
  useCreateAppRule,
  useUpdateAppRule,
  useDeleteAppRule,
  useReorderAppRules,
} from '@/hooks/useAppRules';
import type { Rule, RuleCreateRequest } from '@/lib/api-client';

interface AppRulesSectionProps {
  appId: string;
}

const DEFAULT_FORM: RuleCreateRequest = {
  name: '',
  description: '',
  scope: 'app',
  rule_group: 'custom',
  expression_raw: '',
  action: 'block',
  skip_modules: [],
  priority: 10,
  enabled: true,
};

const DEFAULT_GROUP: ConditionGroup = { id: 'root', conditions: [] };

export function AppRulesSection({ appId }: AppRulesSectionProps) {
  const { data: rules, isLoading } = useAppRules(appId);
  const createRule = useCreateAppRule(appId);
  const updateRule = useUpdateAppRule(appId);
  const deleteRule = useDeleteAppRule(appId);
  const reorderRules = useReorderAppRules(appId);
  const validateExpression = useValidateExpression();
  const { data: ruleEvents } = useRuleEvents(30);
  const { addToast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // View state: list or form
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  // Delete dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);

  // Form state
  const [formData, setFormData] = useState<RuleCreateRequest>(DEFAULT_FORM);
  const [builderMode, setBuilderMode] = useState<'visual' | 'raw'>('visual');
  const [expressionGroup, setExpressionGroup] = useState<ConditionGroup>(DEFAULT_GROUP);
  const [rawExpression, setRawExpression] = useState('');
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [fields, setFields] = useState<Record<string, FieldDefinition>>({});

  useEffect(() => {
    fetchFieldMetadata()
      .then(setFields)
      .catch(() => {});
  }, []);

  const sortedRules = rules ? [...rules].sort((a, b) => a.priority - b.priority) : [];

  const openCreate = () => {
    const nextPriority =
      rules && rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) + 10 : 10;
    setFormData({ ...DEFAULT_FORM, priority: nextPriority });
    setExpressionGroup(DEFAULT_GROUP);
    setRawExpression('');
    setBuilderMode('visual');
    setValidationResult(null);
    setEditingRule(null);
    setView('form');
  };

  const openEdit = (rule: Rule) => {
    setFormData({
      name: rule.name,
      description: rule.description || '',
      scope: 'app',
      rule_group: rule.rule_group,
      expression_raw: rule.expression_raw,
      action: rule.action,
      skip_modules: rule.skip_modules || [],
      priority: rule.priority,
      enabled: rule.enabled,
    });
    setRawExpression(rule.expression_raw);
    if (rule.expression_structure) {
      setExpressionGroup(astToConditionGroup(rule.expression_structure));
      setBuilderMode('visual');
    } else {
      setExpressionGroup(DEFAULT_GROUP);
      setBuilderMode('raw');
    }
    setValidationResult(null);
    setEditingRule(rule);
    setView('form');
  };

  const getCurrentExpression = () => {
    if (builderMode === 'visual') return generateExpression(expressionGroup, fields);
    return rawExpression;
  };

  const handleValidate = async () => {
    const expression = getCurrentExpression();
    if (!expression) {
      setValidationResult({ valid: false, error: 'Expression is required' });
      return;
    }
    try {
      const result = await validateExpression.mutateAsync(expression);
      setValidationResult(result);
    } catch {
      setValidationResult({ valid: false, error: 'Validation failed' });
    }
  };

  const handleSubmit = async () => {
    const expression = getCurrentExpression();
    if (!formData.name || !expression) {
      addToast('Name and expression are required', 'error');
      return;
    }
    const payload: RuleCreateRequest = {
      ...formData,
      scope: 'app',
      app_id: appId,
      expression_raw: expression,
    };
    try {
      if (editingRule) {
        await updateRule.mutateAsync({ id: editingRule.id, data: payload });
        addToast('Rule updated successfully', 'success');
      } else {
        await createRule.mutateAsync(payload);
        addToast('Rule created successfully', 'success');
      }
      setView('list');
      setEditingRule(null);
    } catch (error: any) {
      addToast(error?.message || 'Failed to save rule', 'error');
    }
  };

  const handleToggle = async (rule: Rule) => {
    try {
      await updateRule.mutateAsync({
        id: rule.id,
        data: {
          name: rule.name,
          description: rule.description,
          scope: 'app',
          app_id: appId,
          rule_group: rule.rule_group,
          expression_raw: rule.expression_raw,
          action: rule.action,
          skip_modules: rule.skip_modules || [],
          priority: rule.priority,
          enabled: !rule.enabled,
        },
      });
      addToast(`Rule ${!rule.enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (error: any) {
      addToast(error?.message || 'Failed to toggle rule', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!ruleToDelete) return;
    try {
      await deleteRule.mutateAsync(ruleToDelete.id);
      addToast('Rule deleted successfully', 'success');
      setIsDeleteOpen(false);
      setRuleToDelete(null);
    } catch (error: any) {
      addToast(error?.message || 'Failed to delete rule', 'error');
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedRules.findIndex((r) => r.id === active.id);
    const newIndex = sortedRules.findIndex((r) => r.id === over.id);
    const newOrder = arrayMove(sortedRules, oldIndex, newIndex);
    try {
      await reorderRules.mutateAsync(newOrder.map((r) => r.id));
      addToast('Rules reordered', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Failed to reorder rules', 'error');
    }
  };

  const isPending = createRule.isPending || updateRule.isPending;
  const currentExpression = getCurrentExpression();

  // ── Form view ──────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="space-y-6 animate-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => { setView('list'); setEditingRule(null); }}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {editingRule ? 'Edit Rule' : 'Create Rule'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {editingRule ? 'Update rule configuration' : 'Add a new security rule'}
            </p>
          </div>
        </div>

        {/* Form card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rule Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name *</Label>
              <Input
                id="rule-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Block bad bots"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="rule-desc">Description</Label>
              <Textarea
                id="rule-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this rule does..."
                rows={2}
              />
            </div>

            {/* Expression */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Expression *</Label>
                <div className="flex gap-2">
                  <div className="inline-flex rounded border border-border bg-muted">
                    <button
                      type="button"
                      onClick={() => setBuilderMode('visual')}
                      className={`px-3 py-1 text-xs font-medium rounded-l transition-colors ${
                        builderMode === 'visual'
                          ? 'btn-primary text-white'
                          : 'text-muted-foreground hover:bg-background/50'
                      }`}
                    >
                      <Wand2 className="w-3 h-3 inline mr-1" />
                      Visual
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuilderMode('raw')}
                      className={`px-3 py-1 text-xs font-medium rounded-r transition-colors ${
                        builderMode === 'raw'
                          ? 'btn-primary text-white'
                          : 'text-muted-foreground hover:bg-background/50'
                      }`}
                    >
                      <Code className="w-3 h-3 inline mr-1" />
                      Raw
                    </button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleValidate}
                    disabled={!currentExpression || validateExpression.isPending}
                  >
                    {validateExpression.isPending ? 'Validating...' : 'Validate'}
                  </Button>
                </div>
              </div>

              {builderMode === 'visual' && (
                <div className="border border-border rounded p-4 bg-background">
                  <ExpressionBuilder value={expressionGroup} onChange={setExpressionGroup} />
                </div>
              )}

              {builderMode === 'raw' && (
                <Textarea
                  value={rawExpression}
                  onChange={(e) => {
                    setRawExpression(e.target.value);
                    setValidationResult(null);
                  }}
                  placeholder='http.request.uri.path contains "/admin"'
                  rows={6}
                  className="font-mono text-sm"
                />
              )}

              {builderMode === 'visual' && currentExpression && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Preview:</Label>
                  <div className="bg-secondary/50 p-3 rounded border border-border">
                    <code className="text-sm font-mono">{currentExpression}</code>
                  </div>
                </div>
              )}

              {validationResult && (
                <div
                  className={`flex items-center gap-2 text-sm ${
                    validationResult.valid ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {validationResult.valid ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Expression is valid</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>{validationResult.error || 'Invalid expression'}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Action & Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-action">Action *</Label>
                <Select
                  id="rule-action"
                  value={formData.action}
                  onChange={(e) =>
                    setFormData({ ...formData, action: e.target.value as RuleCreateRequest['action'], skip_modules: e.target.value === 'skip' ? formData.skip_modules : [] })
                  }
                >
                  <option value="allow">Allow</option>
                  <option value="block">Block</option>
                  <option value="challenge">Challenge</option>
                  <option value="log">Log</option>
                  <option value="skip">Skip</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-priority">Priority *</Label>
                <Input
                  id="rule-priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            {/* Skip Modules Checkboxes (shown only when action=skip) */}
            {formData.action === 'skip' && (
              <div className="space-y-3 p-4 border border-border rounded bg-secondary/30">
                <Label>Skip Modules</Label>
                <p className="text-xs text-muted-foreground">
                  Select which security modules to bypass for matched traffic. Unchecked modules still run normally.
                </p>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {[
                    { value: 'waf', label: 'WAF Managed Rules' },
                    { value: 'bot', label: 'Bot Detection' },
                    { value: 'rate_limit', label: 'Rate Limiting' },
                    { value: 'ip_reputation', label: 'IP Reputation' },
                    { value: 'protocol_anomaly', label: 'Protocol Anomaly' },
                    { value: 'flood', label: 'Flood Protection' },
                  ].map((mod) => (
                    <label key={mod.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={formData.skip_modules?.includes(mod.value) || false}
                        onChange={(e) => {
                          const modules = formData.skip_modules || [];
                          if (e.target.checked) {
                            setFormData({ ...formData, skip_modules: [...modules, mod.value] });
                          } else {
                            setFormData({ ...formData, skip_modules: modules.filter(m => m !== mod.value) });
                          }
                        }}
                      />
                      <span className="text-sm">{mod.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Lower priority rules are evaluated first in the pipeline
            </p>

            {/* Enabled */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label>Enable Rule</Label>
                <p className="text-xs text-muted-foreground mt-1">Disabled rules are not evaluated</p>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => { setView('list'); setEditingRule(null); }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.name || !currentExpression || isPending}
            className="btn-primary hover:opacity-90 shadow-none px-6"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : editingRule ? (
              <Save className="w-4 h-4 mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {isPending ? 'Saving...' : editingRule ? 'Save' : 'Create'}
          </Button>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="border border-border rounded-lg p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 w-full bg-muted/50 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-row items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Security Rules</h2>
        </div>
        <Button
          onClick={openCreate}
          className="btn-primary hover:opacity-90 shadow-none px-6 h-9 flex-shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Rule
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full">
              <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
                <tr>
                  <th className="w-10" />
                  <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6">
                    Priority
                  </th>
                  <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-48">
                    Rule Name
                  </th>
                  <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6">
                    Expression
                  </th>
                  <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-24">
                    Events
                  </th>
                  <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-32">
                    Action
                  </th>
                  <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-32">
                    Status
                  </th>
                  <th className="text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-32">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                <SortableContext
                  items={sortedRules.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {sortedRules.length > 0 ? (
                    sortedRules.map((rule) => (
                      <AppRuleRow
                        key={rule.id}
                        rule={rule}
                        onToggle={handleToggle}
                        onEdit={openEdit}
                        onDelete={(r) => {
                          setRuleToDelete(r);
                          setIsDeleteOpen(true);
                        }}
                        isReordering={
                          reorderRules.isPending && reorderRules.variables?.includes(rule.id)
                        }
                        triggerCount={ruleEvents?.[rule.id] ?? 0}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">No rules yet</p>
                            <p className="text-xs text-muted-foreground">
                              Add a rule to start filtering requests for this app.
                            </p>
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
      </div>

      <RuleDeleteDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          setIsDeleteOpen(open);
          if (!open) setRuleToDelete(null);
        }}
        rule={ruleToDelete}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}


