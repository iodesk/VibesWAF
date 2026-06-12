import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import type { Rule } from '@/lib/api-client';

interface RuleDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: Rule | null;
  onConfirm: () => void;
}

export function RuleDeleteDialog({ open, onOpenChange, rule, onConfirm }: RuleDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="px-6 py-5 bg-muted border-b border-border">
          <div className="flex items-center gap-3 text-foreground">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <DialogTitle className="text-lg font-bold">Delete Security Rule</DialogTitle>
          </div>
        </DialogHeader>
        <div className="px-8 py-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Are you sure you want to delete{' '}
            <strong className="text-foreground font-bold">{rule?.name}</strong>? This rule will be
            immediately removed from the request processing pipeline.
          </p>
        </div>
        <DialogFooter className="px-6 py-4 bg-muted border-t border-border">
          <Button
            variant="ghost"
            className="text-muted-foreground font-bold"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-none px-6 font-bold"
            onClick={onConfirm}
          >
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
