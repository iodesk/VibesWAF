import { Database, Zap, ShieldX, ShieldAlert, WifiOff } from 'lucide-react'
import { useCacheStats } from '@/hooks/useApi'

export function CacheMetrics() {
  const { data: stats } = useCacheStats()

  if (!stats) return null

  if (!stats.enabled) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg bg-card text-muted-foreground">
        <WifiOff className="w-3 h-3 shrink-0" />
        <span className="text-[10px] font-medium uppercase tracking-wide">Cache offline</span>
      </div>
    )
  }

  const total = stats.hits + stats.misses
  if (total === 0) return null

  const items = [
    {
      icon: Database,
      label: 'Hit Rate',
      value: `${stats.hit_rate.toFixed(1)}%`,
      color: stats.hit_rate >= 50
        ? 'text-emerald-500'
        : stats.hit_rate >= 20
          ? 'text-amber-500'
          : 'text-rose-500',
    },
    {
      icon: Zap,
      label: 'Latency',
      value: `${stats.avg_latency_ms.toFixed(2)}ms`,
      color: stats.avg_latency_ms < 1
        ? 'text-emerald-500'
        : stats.avg_latency_ms < 3
          ? 'text-amber-500'
          : 'text-rose-500',
    },
    {
      icon: ShieldX,
      label: 'Block',
      value: stats.block_hits.toLocaleString(),
      color: 'text-rose-500',
    },
    {
      icon: ShieldAlert,
      label: 'Challenge',
      value: stats.challenge_hits.toLocaleString(),
      color: 'text-amber-500',
    },
  ]

  return (
    <div className="flex items-center divide-x divide-border border border-border rounded-lg bg-card overflow-x-auto scrollbar-thin">
      {items.map((m) => {
        const Icon = m.icon
        return (
          <div key={m.label} className="flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap">
            <Icon className={`w-3 h-3 ${m.color} shrink-0`} />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{m.label}</span>
            <span className="text-[12px] font-bold font-mono text-foreground">{m.value}</span>
          </div>
        )
      })}
    </div>
  )
}
