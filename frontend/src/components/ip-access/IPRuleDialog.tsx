import { useEffect, useState } from 'react';
import { IPAccessRule, IPAccessRuleCreateRequest } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface IPRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule?: IPAccessRule | null;
  onSubmit: (data: IPAccessRuleCreateRequest) => void;
  isLoading?: boolean;
}

export function IPRuleDialog({ open, onOpenChange, rule, onSubmit, isLoading }: IPRuleDialogProps) {
  const [formData, setFormData] = useState<IPAccessRuleCreateRequest>({
    ip_range: '',
    description: '',
    action: 'block',
    enabled: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (rule) {
      setFormData({
        ip_range: rule.ip_range,
        description: rule.description,
        action: rule.action,
        enabled: rule.enabled,
      });
    } else {
      setFormData({
        ip_range: '',
        description: '',
        action: 'block',
        enabled: true,
      });
    }
    setErrors({});
  }, [rule, open]);

  const validateIPRange = (value: string): boolean => {
    if (!value.trim()) {
      setErrors(prev => ({ ...prev, ip_range: 'IP address or CIDR is required' }));
      return false;
    }

    // Basic validation for IPv4/IPv6 and CIDR
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/;

    if (!ipv4Regex.test(value) && !ipv6Regex.test(value)) {
      setErrors(prev => ({ ...prev, ip_range: 'Invalid IP address or CIDR notation' }));
      return false;
    }

    setErrors(prev => {
      const { ip_range, ...rest } = prev;
      return rest;
    });
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateIPRange(formData.ip_range)) {
      return;
    }

    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit IP Access Rule' : 'Create IP Access Rule'}</DialogTitle>
          <DialogDescription>
            {rule
              ? 'Update the IP access rule configuration.'
              : 'Add a new IP address or CIDR block to control access.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 px-6 py-6">
            {/* IP Range */}
            <div className="space-y-2">
              <Label htmlFor="ip_range">
                IP Address / CIDR <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ip_range"
                placeholder="192.168.1.0/24 or 2602:f9f3::/32"
                value={formData.ip_range}
                onChange={(e) => {
                  setFormData({ ...formData, ip_range: e.target.value });
                  if (errors.ip_range) {
                    validateIPRange(e.target.value);
                  }
                }}
                onBlur={(e) => validateIPRange(e.target.value)}
                className={errors.ip_range ? 'border-red-500' : ''}
              />
              {errors.ip_range && (
                <p className="text-sm text-red-500">{errors.ip_range}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Examples: 192.168.1.1, 10.0.0.0/8, 2001:db8::/32
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="e.g., Office network, VPN users, Known malicious IPs"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            {/* Action */}
            <div className="space-y-2">
              <Label htmlFor="action">
                Action <span className="text-red-500">*</span>
              </Label>
              <select
                id="action"
                value={formData.action}
                onChange={(e) => setFormData({ ...formData, action: e.target.value as 'allow' | 'block' | 'challenge' })}
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enabled">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  Activate this rule
                </p>
              </div>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
