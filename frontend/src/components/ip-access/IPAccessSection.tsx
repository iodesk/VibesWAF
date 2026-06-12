import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/toast';import {
  Plus,
  AlertCircle,
  ArrowLeft,
  Save,
  Pause,
  Play,
  Edit2,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  useIPAccessRules,
  useCreateIPAccessRule,
  useUpdateIPAccessRule,
  useDeleteIPAccessRule,
} from '@/hooks/useIPAccessRules';
import type { IPAccessRule, IPAccessRuleCreateRequest } from '@/lib/api-client';

interface IPAccessSectionProps {
  appId: string;
}

const DEFAULT_FORM: IPAccessRuleCreateRequest = {
  ip_range: '',
  description: '',
  action: 'block',
  enabled: true,
};

export function IPAccessSection({ appId }: IPAccessSectionProps) {
  const { data: ipRules, isLoading } = useIPAccessRules(appId);
  const createIPRule = useCreateIPAccessRule(appId);
  const updateIPRule = useUpdateIPAccessRule(appId);
  const deleteIPRule = useDeleteIPAccessRule(appId);
  const { addToast } = useToast();

  // View state
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingRule, setEditingRule] = useState<IPAccessRule | null>(null);

  // Form state
  const [formData, setFormData] = useState<IPAccessRuleCreateRequest>(DEFAULT_FORM);
  const [ipRangeError, setIpRangeError] = useState('');

  // Delete dialog
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<number | null>(null);

  const openCreate = () => {
    setFormData(DEFAULT_FORM);
    setIpRangeError('');
    setEditingRule(null);
    setView('form');
  };

  const openEdit = (rule: IPAccessRule) => {
    setFormData({
      ip_range: rule.ip_range,
      description: rule.description,
      action: rule.action,
      enabled: rule.enabled,
    });
    setIpRangeError('');
    setEditingRule(rule);
    setView('form');
  };

  const validateIPRange = (value: string): boolean => {
    if (!value.trim()) {
      setIpRangeError('IP address or CIDR is required');
      return false;
    }
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/;
    if (!ipv4Regex.test(value) && !ipv6Regex.test(value)) {
      setIpRangeError('Invalid IP address or CIDR notation');
      return false;
    }
    setIpRangeError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateIPRange(formData.ip_range)) return;
    try {
      if (editingRule) {
        await updateIPRule.mutateAsync({ id: editingRule.id, data: formData });
        addToast('IP access rule updated successfully', 'success');
      } else {
        await createIPRule.mutateAsync(formData);
        addToast('IP access rule created successfully', 'success');
      }
      setView('list');
      setEditingRule(null);
    } catch (error: any) {
      addToast(error?.message || 'Failed to save IP access rule', 'error');
    }
  };

  const handleToggle = async (id: number, enabled: boolean) => {
    try {
      await updateIPRule.mutateAsync({ id, data: { enabled } });
      addToast(`IP access rule ${enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (error: any) {
      addToast(error?.message || 'Failed to toggle IP access rule', 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!ruleToDelete) return;
    try {
      await deleteIPRule.mutateAsync(ruleToDelete);
      addToast('IP access rule deleted successfully', 'success');
      setIsDeleteOpen(false);
      setRuleToDelete(null);
    } catch (error: any) {
      addToast(error?.message || 'Failed to delete IP access rule', 'error');
    }
  };

  const isPending = createIPRule.isPending || updateIPRule.isPending;

  // ── Form view ──────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="space-y-6 animate-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setView('list'); setEditingRule(null); }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {editingRule ? 'Edit IP Access Rule' : 'Create IP Access Rule'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {editingRule
                ? 'Update the IP access rule configuration'
                : 'Add a new IP address or CIDR block to control access'}
            </p>
          </div>
        </div>

        {/* Form card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rule Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* IP Range */}
            <div className="space-y-2">
              <Label htmlFor="ip-range">
                IP Address / CIDR <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ip-range"
                placeholder="192.168.1.0/24 or 2602:f9f3::/32"
                value={formData.ip_range}
                onChange={(e) => {
                  setFormData({ ...formData, ip_range: e.target.value });
                  if (ipRangeError) validateIPRange(e.target.value);
                }}
                onBlur={(e) => validateIPRange(e.target.value)}
                className={ipRangeError ? 'border-red-500' : ''}
              />
              {ipRangeError && (
                <p className="text-sm text-red-500">{ipRangeError}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Examples: 192.168.1.1, 10.0.0.0/8, 2001:db8::/32
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="ip-desc">Description</Label>
              <Textarea
                id="ip-desc"
                placeholder="e.g., Office network, VPN users, Known malicious IPs"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Action */}
            <div className="space-y-2">
              <Label htmlFor="ip-action">
                Action <span className="text-red-500">*</span>
              </Label>
              <select
                id="ip-action"
                value={formData.action}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    action: e.target.value as 'allow' | 'block' | 'challenge',
                  })
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:ring-2 focus:ring-ring outline-none"
              >
                <option value="allow">Allow</option>
                <option value="block">Block</option>
                <option value="challenge">Challenge</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Allow: Bypass all checks | Block: Deny access | Challenge: Show CAPTCHA
              </p>
            </div>

            {/* Enabled */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label>Enabled</Label>
                <p className="text-xs text-muted-foreground mt-1">Activate this rule</p>
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
            disabled={!formData.ip_range || isPending}
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
          <h2 className="text-lg font-semibold text-foreground">IP Access</h2>
        </div>
        <Button
          onClick={openCreate}
          className="btn-primary hover:opacity-90 shadow-none px-6 h-9 flex-shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        {ipRules && ipRules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
                <tr>
                  <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-20">
                    Order
                  </th>
                  <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6">
                    IP / CIDR
                  </th>
                  <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6">
                    Notes
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
                {ipRules.map((rule) => (
                  <tr key={rule.id} className="group hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-6">
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] py-0 px-2 h-5"
                      >
                        #{rule.id}
                      </Badge>
                    </td>
                    <td className="py-4 px-6">
                      <code className="text-[10px] font-mono text-foreground bg-muted/50 p-1 px-1.5 rounded border border-border/50 inline-block">
                        {rule.ip_range}
                      </code>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs text-foreground">
                        {rule.description || (
                          <span className="text-muted-foreground italic">No description</span>
                        )}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <Badge
                        className={`capitalize text-[10px] font-bold py-0.5 px-2.5 rounded-full border-none shadow-none ${
                          rule.action === 'block'
                            ? 'action-block'
                            : rule.action === 'challenge'
                            ? 'action-challenge'
                            : 'action-allow'
                        }`}
                      >
                        {rule.action}
                      </Badge>
                    </td>
                    <td className="py-4 px-6 w-32">
                      {rule.enabled ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full status-active" />
                          <span className="text-[11px] font-medium text-muted-foreground">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                          <span className="text-[11px] font-medium text-muted-foreground">Disabled</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right w-32">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggle(rule.id, !rule.enabled)}
                          title={rule.enabled ? 'Disable' : 'Enable'}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          {rule.enabled ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(rule)}
                          title="Edit"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setRuleToDelete(rule.id);
                            setIsDeleteOpen(true);
                          }}
                          title="Delete"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">No IP access rules yet</p>
                <p className="text-xs text-muted-foreground">
                  Add a rule to control access by IP address or CIDR block.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 py-5 bg-muted border-b border-border">
            <div className="flex items-center gap-3 text-foreground">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <DialogTitle className="text-lg font-bold">Delete IP Access Rule</DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-8 py-6">
            <p className="text-sm text-foreground leading-relaxed">
              Are you sure you want to delete this IP access rule? This will immediately affect
              request processing.
            </p>
          </div>
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border">
            <Button
              variant="ghost"
              className="text-muted-foreground font-bold"
              onClick={() => {
                setIsDeleteOpen(false);
                setRuleToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-none px-6 font-bold"
              onClick={handleDeleteConfirm}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
