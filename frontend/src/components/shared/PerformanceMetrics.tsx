import { Cpu, Globe, Zap, Database } from 'lucide-react'
import { usePerformanceStats, useCacheStats } from '@/hooks/useApi'

export function PerformanceMetrics() {
  const { data: stats } = usePerformanceStats()
  const { data: cacheStats } = useCacheStats()

  if (!stats || stats.request_count === 0) return null

  const fmt = (v: number) => {
    if (v === 0) return '0'
    if (v < 1) return v.toFixed(2)
    if (v < 10) return v.toFixed(1)
    return Math.round(v).toString()
  }

  const cards = [
    { label: 'Engine', icon: Cpu, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', p50: stats.p50_pipeline_ms, p95: stats.p95_pipeline_ms, p99: stats.p99_pipeline_ms },
    { label: 'Upstream', icon: Globe, color: 'text-blue-500', bgColor: 'bg-blue-500/10', p50: stats.p50_upstream_ms, p95: stats.p95_upstream_ms, p99: stats.p99_upstream_ms },
    { label: 'Total', icon: Zap, color: 'text-amber-500', bgColor: 'bg-amber-500/10', p50: stats.p50_latency_ms, p95: stats.p95_latency_ms, p99: stats.p99_latency_ms },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div key={card.label} className="border border-border rounded-lg bg-card px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className={`w-4 h-4 rounded ${card.bgColor} flex items-center justify-center`}>
                <Icon className={`w-2.5 h-2.5 ${card.color}`} />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">{card.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[9px] text-muted-foreground">P50</span>
              <span className="text-[12px] font-bold font-mono text-foreground">{fmt(card.p50)}<span className="text-[9px] font-normal text-muted-foreground">ms</span></span>
              <span className="text-[9px] text-muted-foreground">P95</span>
              <span className="text-[12px] font-bold font-mono text-foreground">{fmt(card.p95)}<span className="text-[9px] font-normal text-muted-foreground">ms</span></span>
              <span className="text-[9px] text-muted-foreground">P99</span>
              <span className="text-[12px] font-bold font-mono text-foreground">{fmt(card.p99)}<span className="text-[9px] font-normal text-muted-foreground">ms</span></span>
            </div>
          </div>
        )
      })}

      {/* Redis */}
      <div className="border border-border rounded-lg bg-card px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <div className="w-4 h-4 rounded bg-purple-500/10 flex items-center justify-center">
            <Database className="w-2.5 h-2.5 text-purple-500" />
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase">Redis</span>
          <span className={`ml-auto w-1.5 h-1.5 rounded-full ${cacheStats?.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] text-muted-foreground">Latency</span>
          <span className="text-[12px] font-bold font-mono text-foreground">{cacheStats?.enabled ? fmt(cacheStats.avg_latency_ms) : '—'}<span className="text-[9px] font-normal text-muted-foreground">{cacheStats?.enabled ? 'ms' : ''}</span></span>
          <span className="text-[9px] text-muted-foreground">Status</span>
          <span className="text-[12px] font-bold font-mono text-foreground">{cacheStats?.enabled ? 'On' : 'Off'}</span>
        </div>
      </div>
    </div>
  )
}
