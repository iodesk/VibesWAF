import { IPAccessRule } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Edit2, Trash2, Pause, Play } from 'lucide-react';

interface IPAccessRulesTableProps {
  rules: IPAccessRule[];
  onEdit: (rule: IPAccessRule) => void;
  onDelete: (id: number) => void;
  onToggle: (id: number, enabled: boolean) => void;
}

export function IPAccessRulesTable({ rules, onEdit, onDelete, onToggle }: IPAccessRulesTableProps) {
  if (rules.length === 0) {
    return (
      <Card className="shadow-none border-border">
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">No IP access rules configured yet.</p>
          <p className="text-sm text-muted-foreground mt-2">Create your first rule to control access by IP address or CIDR block.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-none border-border overflow-hidden">
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
            {rules.map((rule) => (
              <tr key={rule.id} className="group hover:bg-muted/30 transition-colors">
                <td className="py-4 px-6">
                  <Badge variant="outline" className="font-mono text-[10px] py-0 px-2 h-5">
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
                    {rule.description || <span className="text-muted-foreground italic">No description</span>}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <Badge
                    className={`capitalize text-[10px] font-bold py-0.5 px-2.5 rounded-full border-none shadow-none ${rule.action === 'block' ? 'action-block' :
                        rule.action === 'challenge' ? 'action-challenge' :
                          'action-allow'
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
                      onClick={() => onToggle(rule.id, !rule.enabled)}
                      title={rule.enabled ? "Disable" : "Enable"}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      {rule.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(rule)}
                      title="Edit"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(rule.id)}
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
    </Card>
  );
}
