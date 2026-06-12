import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GripVertical, Loader2, Pause, Play, SquarePen, Trash2, Shield } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Rule } from '@/lib/api-client'

interface AppRuleRowProps {
  rule: Rule
  onToggle: (r: Rule) => void
  onEdit: (r: Rule) => void
  onDelete: (r: Rule) => void
  isReordering?: boolean
  triggerCount?: number
}

export function AppRuleRow({ rule, onToggle, onEdit, onDelete, isReordering, triggerCount }: AppRuleRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group transition-colors ${
        isDragging ? 'bg-muted/50 shadow-sm' : isReordering ? 'bg-muted/80' : 'hover:bg-muted/30'
      }`}
    >
      <td className="py-4 px-6 w-10">
        {isReordering ? (
          <div className="flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          </div>
        ) : (
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing flex items-center justify-center"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        )}
      </td>
      <td className="py-4 px-6 w-16">
        <Badge
          variant="outline"
          className="font-mono text-[10px] py-0 px-2 h-5 bg-muted border-border text-muted-foreground"
        >
          #{rule.priority}
        </Badge>
      </td>
      <td className="py-4 px-6" style={{ minWidth: '192px', maxWidth: '192px' }}>
        <div className="flex items-center gap-2 overflow-hidden">
          <Shield className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
          <span
            className="font-bold text-xs text-foreground hover:text-foreground cursor-pointer truncate"
            onClick={() => onEdit(rule)}
            title={rule.name}
          >
            {rule.name}
          </span>
        </div>
      </td>
      <td className="py-4 px-6">
        <code
          className="text-[10px] font-mono text-muted-foreground bg-muted/50 p-1 px-1.5 rounded border border-border/50 inline-block max-w-[200px] lg:max-w-md truncate"
          title={rule.expression_raw}
        >
          {rule.expression_raw}
        </code>
      </td>
      <td className="py-4 px-6 w-24">
        <span className="font-mono text-[12px] text-foreground">
          {triggerCount ?? 0}
        </span>
      </td>
      <td className="py-4 px-6 w-32">
        <Badge
          className={`capitalize text-[10px] font-bold py-0.5 px-2.5 rounded-full border-none shadow-none ${
            rule.action === 'block'
              ? 'action-block'
              : rule.action === 'challenge'
              ? 'action-challenge'
              : rule.action === 'allow'
              ? 'action-allow'
              : rule.action === 'skip'
              ? 'action-skip'
              : 'bg-muted text-muted-foreground'
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
            <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
            <span className="text-[11px] font-medium text-muted-foreground">Disabled</span>
          </div>
        )}
      </td>
      <td className="py-4 px-6 text-right w-32">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggle(rule)}
            title={rule.enabled ? 'Disable' : 'Enable'}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {rule.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(rule)}
            title="Edit"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <SquarePen className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(rule)}
            title="Delete"
            className="h-8 w-8 text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
