import { ArrowUpRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface StatCardProps {
  title: string
  value: number
  icon: React.ReactNode
  variant: 'slate' | 'rose' | 'amber' | 'emerald' | 'blue'
  percentage?: number
  description: string
  trend?: number
}

const variantMap: Record<StatCardProps['variant'], { icon: string }> = {
  slate:   { icon: 'icon-container-neutral' },
  rose:    { icon: 'icon-container-danger' },
  amber:   { icon: 'icon-container-warning' },
  emerald: { icon: 'icon-container-success' },
  blue:    { icon: 'icon-container-primary' },
}

export function StatCard({ title, value, icon, variant, percentage, description, trend }: StatCardProps) {
  const v = variantMap[variant]

  return (
    <Card className="shadow-none border-border overflow-hidden transition-colors">
      <div className="h-0.5 w-full" />
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-start justify-between mb-3">
          <div className={`p-2 rounded-md ${v.icon}`}>
            {icon}
          </div>
          {trend !== undefined && (
            <div className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
              <ArrowUpRight className="w-3 h-3" />
              {Math.abs(trend).toFixed(1)}%
            </div>
          )}
        </div>
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-foreground tabular-nums">{value.toLocaleString()}</span>
          {percentage !== undefined && (
            <span className="text-[11px] font-medium text-muted-foreground">{percentage.toFixed(1)}%</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}
