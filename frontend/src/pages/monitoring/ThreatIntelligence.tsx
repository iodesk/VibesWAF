import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  useThreatIPs,
  useWAFRuleIntel,
  useThreatSummary,
  useTopThreats,
  useDashboardInsights,
  useTopBlockedBots,
  useApps,
  useCustomRuleIntel,
} from '@/hooks/useApi'
import { useTheme } from '@/contexts/ThemeContext'
import { getCountryFlag, getCountryName } from '@/lib/countries'
import {
  Shield, Globe, Bot, AlertTriangle,
  Cpu, TrendingUp, MapPin, Activity,
  Zap, Lock, BookOpen,
} from 'lucide-react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const CATEGORY_COLORS: Record<string, string> = {
  bot_detection:    'bg-blue-500',
  waf_rule:         'bg-rose-500',
  ip_reputation:    'bg-cyan-500',
  protocol_anomaly: 'bg-amber-500',
  rate_limit:       'bg-orange-500',
  custom_rule:      'bg-violet-500',
  ip_access:        'bg-red-500',
}

const CATEGORY_LABELS: Record<string, string> = {
  bot_detection:    'Bot Detection',
  waf_rule:         'WAF Rule',
  ip_reputation:    'IP Reputation',
  protocol_anomaly: 'Protocol Anomaly',
  rate_limit:       'Rate Limit',
  custom_rule:      'Custom Rule',
  ip_access:        'IP Access Rule',
}

function RangePicker({
  value,
  onChange,
}: {
  value: '5min' | '15min' | '1h' | '1d' | '7d' | '30d'
  onChange: (v: '5min' | '15min' | '1h' | '1d' | '7d' | '30d') => void
}) {
  return (
    <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
      {(['5min', '15min', '1h', '1d', '7d', '30d'] as const).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md transition-all ${
            value === r
              ? 'btn-primary hover:opacity-90 shadow-none text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {r === '5min' ? '5Min' : r === '15min' ? '15Min' : r === '1h' ? '1H' : r.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2.5">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="h-3 w-24 bg-muted rounded animate-pulse" />
          <div className="flex-1 h-3 bg-muted/60 rounded animate-pulse" />
          <div className="h-3 w-10 bg-muted/40 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export default function ThreatIntelligence() {
  const { theme } = useTheme()
  const [range, setRange] = useState<'5min' | '15min' | '1h' | '1d' | '7d' | '30d'>(() => {
    const saved = localStorage.getItem('threat-intel-range')
    return (['5min','15min','1h','1d','7d','30d'] as const).includes(saved as any) ? saved as any : '7d'
  })
  const [appId, setAppId] = useState<string | undefined>(undefined)

  const handleRangeChange = (v: '5min' | '15min' | '1h' | '1d' | '7d' | '30d') => {
    setRange(v)
    localStorage.setItem('threat-intel-range', v)
  }

  const { data: apps }                                              = useApps()
  const { data: threatIPs, isLoading: ipsLoading }                 = useThreatIPs(range, appId)
  const { data: wafRules, isLoading: rulesLoading }                = useWAFRuleIntel(range, appId)
  const { data: summary, isLoading: summaryLoading }               = useThreatSummary(range, appId)
  const { data: topThreats }                                       = useTopThreats(range, appId)
  const { data: insights }                                         = useDashboardInsights(range, appId)
  const { data: blockedBots }                                      = useTopBlockedBots(range)
  const { data: customRules, isLoading: customRulesLoading }       = useCustomRuleIntel(range, appId)

  const chartColors = {
    grid:         theme === 'dark' ? '#1e2a38' : '#e8ecf0',
    text:         theme === 'dark' ? '#7a8fa8' : '#6b7a8d',
    tooltipBg:    theme === 'dark' ? '#1a2332' : '#ffffff',
    tooltipTitle: theme === 'dark' ? '#dde4ed' : '#1e2a38',
    tooltipBody:  theme === 'dark' ? '#7a8fa8' : '#5a6a7a',
    tooltipBorder:theme === 'dark' ? '#2a3a4a' : '#dde4ed',
  }

  const trendData = summary?.category_trend ?? []
  const scoreDist = summary?.score_distribution ?? []
  const ipItems   = threatIPs?.items ?? []
  const ruleItems = wafRules?.items ?? []
  const bots      = blockedBots ?? []
  const threats   = topThreats ?? []
  const countries = insights?.top_countries ?? []
  const customRuleItems = customRules?.items ?? []

  const totalThreats = threats.reduce((s, t) => s + t.count, 0)

  return (
    <div className="space-y-6 animate-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted-foreground">
            Aggregated intelligence from pipeline signals
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={appId ?? ''}
            onChange={(e) => setAppId(e.target.value || undefined)}
            className="h-8 px-2.5 rounded border border-border bg-background text-xs text-foreground focus:ring-1 focus:ring-ring outline-none"
          >
            <option value="">All Applications</option>
            {apps?.map((app) => (
              <option key={app.id} value={app.id}>{app.domain}</option>
            ))}
          </select>
          <RangePicker value={range} onChange={handleRangeChange} />
        </div>
      </div>

      {/* ── Row 1: Threat Signals + Score Distribution ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top Contributors */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">Top Contributors</CardTitle>
            </div>
            <CardDescription className="text-[11px]">
              Primary scoring category per blocked/challenged event
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-3">
            {threats.length > 0 ? (
              <div className="space-y-2.5">
                {threats.map((t) => {
                  const pct = totalThreats > 0 ? (t.count / totalThreats) * 100 : 0
                  const label = CATEGORY_LABELS[t.category] ?? t.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  const bar   = CATEGORY_COLORS[t.category] ?? 'bg-slate-500'
                  return (
                    <div key={t.category} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-medium text-foreground">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-muted-foreground">{t.count.toLocaleString()}</span>
                          <span className="text-[11px] font-semibold text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground text-center py-8">No threat data</p>
            )}
          </CardContent>
        </Card>

        {/* Score Distribution */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">Risk Score Distribution</CardTitle>
            </div>
            <CardDescription className="text-[11px]">
              Request count per score band  from pipeline trace
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-3">
            {summaryLoading ? (
              <div className="h-48 flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
              </div>
            ) : scoreDist.length > 0 ? (
              <div style={{ height: 192 }}>
                <Bar
                  key={theme}
                  data={{
                    labels: scoreDist.map((b) => b.range),
                    datasets: [{
                      data: scoreDist.map((b) => b.count),
                      backgroundColor: scoreDist.map((b) => {
                        const r = b.range
                        if (r.startsWith('80')) return theme === 'dark' ? 'rgba(239,68,68,0.75)' : 'rgba(220,38,38,0.75)'
                        if (r.startsWith('50') || r.startsWith('60')) return theme === 'dark' ? 'rgba(245,158,11,0.75)' : 'rgba(217,119,6,0.75)'
                        return theme === 'dark' ? 'rgba(16,185,129,0.55)' : 'rgba(5,150,105,0.55)'
                      }),
                      borderRadius: 4,
                      borderSkipped: false,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: chartColors.tooltipBg,
                        titleColor: chartColors.tooltipTitle,
                        bodyColor: chartColors.tooltipBody,
                        borderColor: chartColors.tooltipBorder,
                        borderWidth: 1,
                        padding: 8,
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 }, color: chartColors.text },
                        border: { display: false },
                      },
                      y: {
                        beginAtZero: true,
                        grid: { color: chartColors.grid },
                        ticks: { font: { size: 10 }, color: chartColors.text },
                        border: { display: false },
                      },
                    },
                  }}
                />
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground text-center py-8">No trace data available</p>
            )}
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60" />
                <span className="text-[10px] text-muted-foreground">Low risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-amber-500/75" />
                <span className="text-[10px] text-muted-foreground">Medium risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-red-500/75" />
                <span className="text-[10px] text-muted-foreground">High risk</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Scoring Category Overview ── */}
      <Card className="shadow-none border-border">
        <CardHeader className="px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 icon-neutral" />
            <CardTitle className="text-[13px] font-semibold">Scoring Category Overview</CardTitle>
          </div>
          <CardDescription className="text-[11px]">
            Average score contribution per category across blocked/challenged events
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: 'Protocol Anomaly',
                value: summary?.category_avg?.protocol_anomaly ?? 0,
                icon: <AlertTriangle className="w-4 h-4" />,
                color: 'text-amber-500',
              },
              {
                label: 'Bot Detection',
                value: summary?.category_avg?.bot_detection ?? 0,
                icon: <Bot className="w-4 h-4" />,
                color: 'text-blue-500',
              },
              {
                label: 'WAF Anomaly',
                value: summary?.category_avg?.waf_anomaly ?? 0,
                icon: <Shield className="w-4 h-4" />,
                color: 'text-rose-500',
              },
              {
                label: 'IP Reputation',
                value: summary?.category_avg?.ip_reputation ?? 0,
                icon: <Lock className="w-4 h-4" />,
                color: 'text-cyan-500',
              },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="flex flex-col gap-2 p-3 rounded-lg border border-border">
                <div className={`${color}`}>{icon}</div>
                <p className="text-[11px] font-medium text-muted-foreground leading-tight">{label}</p>
                <p className={`text-xl font-bold font-mono ${color}`}>{value.toFixed(1)}%</p>
                <p className="text-[10px] text-muted-foreground">contribution</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── ASN / Provider Intelligence + Top Threat IPs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ASN / Provider Intelligence */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">ASN / Provider Intelligence</CardTitle>
            </div>
            <CardDescription className="text-[11px]">
              Network providers with highest threat activity  datacenter ASN drives IP Reputation score
            </CardDescription>
          </CardHeader>
        <CardContent className="px-4 py-3">
          {insights?.top_providers?.length > 0 ? (
            <div className="space-y-0 divide-y divide-border/40 max-h-[340px] overflow-y-auto scrollbar-thin">
              {insights.top_providers.slice(0, 12).map((p: { provider: string; total: number; blocked: number; challenged?: number; threat_rate?: number; block_rate: number }, idx: number) => {
                const threatRate = p.threat_rate ?? p.block_rate ?? 0
                const riskLevel = threatRate >= 40 ? 'HIGH' : threatRate >= 15 ? 'MED' : 'LOW'
                const riskColor = threatRate >= 40 ? 'text-red-500 bg-red-500/10' : threatRate >= 15 ? 'text-amber-500 bg-amber-500/10' : 'text-emerald-600 bg-emerald-500/10'
                const threatened = (p.blocked ?? 0) + (p.challenged ?? 0)
                return (
                  <div key={p.provider} className="flex items-start gap-2.5 py-2.5 hover:bg-muted/20 px-1 rounded transition-colors">
                    <span className="text-[10px] font-mono text-muted-foreground/50 w-5 text-right shrink-0 mt-0.5">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{p.provider}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {p.total.toLocaleString()} req
                        {threatened > 0 && (
                          <> · <span className="text-amber-500">{threatened.toLocaleString()} threat</span></>
                        )}
                        {' '}· <span className={threatRate >= 40 ? 'text-red-500' : threatRate >= 15 ? 'text-amber-500' : 'text-muted-foreground'}>{threatRate.toFixed(1)}%</span>
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${riskColor}`}>
                      {riskLevel}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground text-center py-6">No provider data</p>
          )}
        </CardContent>
      </Card>

        {/* Top Threat IPs */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">Top Threat IPs</CardTitle>
            </div>
            <CardDescription className="text-[11px]">
              Source IPs with highest block/challenge volume
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-3">
            {ipsLoading ? (
              <SkeletonRows />
            ) : ipItems.length > 0 ? (
              <div className="space-y-0 divide-y divide-border/40 max-h-[340px] overflow-y-auto scrollbar-thin">
                {ipItems.slice(0, 20).map((ip, idx) => (
                  <div key={ip.ip} className="flex items-center gap-2.5 py-2 hover:bg-muted/20 px-1 rounded transition-colors">
                    <span className="text-[10px] font-mono text-muted-foreground/60 w-5 shrink-0 text-right">{idx + 1}</span>
                    <span className="text-[11px] font-mono text-foreground min-w-[120px]">{ip.ip}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {ip.country ? getCountryFlag(ip.country) : ''}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate flex-1 min-w-0" title={ip.asn_org}>
                      {ip.asn_org || ''}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {ip.blocked > 0 && (
                        <span className="text-[10px] font-semibold text-red-500">{ip.blocked.toLocaleString()} blk</span>
                      )}
                      {ip.challenged > 0 && (
                        <span className="text-[10px] font-semibold text-amber-500">{ip.challenged.toLocaleString()} chg</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground text-center py-8">No threat IP data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Threat Category Trend (full width) ── */}
      <Card className="shadow-none border-border">
        <CardHeader className="px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 icon-neutral" />
            <CardTitle className="text-[13px] font-semibold">Threat Category Trend</CardTitle>
          </div>
          <CardDescription className="text-[11px]">
            Block/challenge events over time, broken down by scoring category
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 py-3">
          {summaryLoading ? (
            <div className="h-56 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            </div>
          ) : trendData.length > 0 ? (
            <div style={{ height: 280 }}>
              <Bar
                key={`trend-${theme}`}
                data={{
                  labels: trendData.map((d) => d.label),
                  datasets: [
                    {
                      label: 'IP Reputation',
                      data: trendData.map((d) => d.ip_reputation),
                      backgroundColor: theme === 'dark' ? 'rgba(34,182,227,0.7)' : 'rgba(6,182,212,0.7)',
                      borderRadius: 2,
                      stack: 'a',
                    },
                    {
                      label: 'Bot Detection',
                      data: trendData.map((d) => d.bot_detection),
                      backgroundColor: theme === 'dark' ? 'rgba(99,179,237,0.7)' : 'rgba(59,130,246,0.7)',
                      borderRadius: 2,
                      stack: 'a',
                    },
                    {
                      label: 'WAF Anomaly',
                      data: trendData.map((d) => d.waf_anomaly),
                      backgroundColor: theme === 'dark' ? 'rgba(239,68,68,0.65)' : 'rgba(220,38,38,0.65)',
                      borderRadius: 2,
                      stack: 'a',
                    },
                    {
                      label: 'Protocol Anomaly',
                      data: trendData.map((d) => d.protocol_anomaly),
                      backgroundColor: theme === 'dark' ? 'rgba(245,158,11,0.65)' : 'rgba(217,119,6,0.65)',
                      borderRadius: 2,
                      stack: 'a',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {
                        font: { size: 10 },
                        color: chartColors.text,
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle',
                      },
                    },
                    tooltip: {
                      backgroundColor: chartColors.tooltipBg,
                      titleColor: chartColors.tooltipTitle,
                      bodyColor: chartColors.tooltipBody,
                      borderColor: chartColors.tooltipBorder,
                      borderWidth: 1,
                      padding: 8,
                    },
                  },
                  scales: {
                    x: {
                      stacked: true,
                      grid: { display: false },
                      ticks: { font: { size: 10 }, color: chartColors.text },
                      border: { display: false },
                    },
                    y: {
                      stacked: true,
                      beginAtZero: true,
                      grid: { color: chartColors.grid },
                      ticks: { font: { size: 10 }, color: chartColors.text },
                      border: { display: false },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Activity className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-[12px]">No trend data</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Row 3: WAF Rules + Security Rule Hits ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Top WAF Rules */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">Top WAF Rules</CardTitle>
            </div>
            <CardDescription className="text-[11px]">
              Most triggered OWASP CRS rules in scoring pipeline
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-3">
            {rulesLoading ? (
              <SkeletonRows />
            ) : ruleItems.length > 0 ? (
              <div className="space-y-0 divide-y divide-border/40 max-h-[340px] overflow-y-auto scrollbar-thin">
                {ruleItems.map((rule, idx) => {
                  const total = rule.total || 1
                  const blockPct = Math.min((rule.blocked / total) * 100, 100)
                  const challPct = Math.min((rule.challenged / total) * 100, 100)
                  return (
                    <div key={rule.rule_id} className="py-2.5 px-1 hover:bg-muted/20 rounded transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-mono text-muted-foreground/60 w-5 text-right shrink-0">{idx + 1}</span>
                        <span className="text-[12px] font-mono font-bold text-foreground">#{rule.rule_id}</span>
                        <span className="text-[11px] font-mono text-muted-foreground ml-auto">{rule.total.toLocaleString()} hits</span>
                      </div>
                      <div className="pl-7 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-red-500 font-medium w-14 shrink-0">{rule.blocked.toLocaleString()} blk</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-red-500/75 rounded-full transition-all" style={{ width: `${blockPct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground w-9 text-right shrink-0">{blockPct.toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-amber-500 font-medium w-14 shrink-0">{rule.challenged.toLocaleString()} chg</span>
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500/65 rounded-full transition-all" style={{ width: `${challPct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground w-9 text-right shrink-0">{challPct.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground text-center py-8">No WAF rule data</p>
            )}
          </CardContent>
        </Card>

        {/* Security Rule Hits */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">Security Rule Hits</CardTitle>
            </div>
            <CardDescription className="text-[11px]">
              Custom rules matched in Phase 1  deterministic hard decisions
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-3">
            {customRulesLoading ? (
              <SkeletonRows rows={4} />
            ) : customRuleItems.length > 0 ? (
              <div className="divide-y divide-border/40 max-h-[340px] overflow-y-auto scrollbar-thin">
                {customRuleItems.map((rule, idx) => {
                  const total = rule.total || 1
                  const blockPct  = Math.min((rule.blocked / total) * 100, 100)
                  const challPct  = Math.min((rule.challenged / total) * 100, 100)
                  const actionColor = rule.blocked > rule.challenged
                    ? 'text-red-500 bg-red-500/10'
                    : 'text-amber-500 bg-amber-500/10'
                  const dominantAction = rule.blocked > rule.challenged ? 'block' : 'challenge'
                  return (
                    <div key={rule.rule_id} className="py-2.5 px-1 hover:bg-muted/20 rounded transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-mono text-muted-foreground/60 w-5 text-right shrink-0">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-medium text-foreground truncate">
                              {rule.rule_name || `Rule #${rule.rule_id}`}
                            </span>
                            <span className="text-[9px] font-mono text-muted-foreground/60">#{rule.rule_id}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${actionColor}`}>
                            {dominantAction.toUpperCase()}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">{rule.total.toLocaleString()} hits</span>
                        </div>
                      </div>
                      <div className="pl-7 space-y-1.5">
                        {rule.blocked > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-red-500 font-medium w-16 shrink-0">{rule.blocked.toLocaleString()} blk</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-red-500/75 rounded-full transition-all" style={{ width: `${blockPct}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground w-9 text-right shrink-0">{blockPct.toFixed(0)}%</span>
                          </div>
                        )}
                        {rule.challenged > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-amber-500 font-medium w-16 shrink-0">{rule.challenged.toLocaleString()} chg</span>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-amber-500/65 rounded-full transition-all" style={{ width: `${challPct}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground w-9 text-right shrink-0">{challPct.toFixed(0)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <BookOpen className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-[12px]">No custom rule hits in this range</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Countries + Bot UAs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Country Threat Distribution */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">Country Risk</CardTitle>
            </div>
            <CardDescription className="text-[11px]">
              Top countries by traffic volume with block rate
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="space-y-0 divide-y divide-border/40 max-h-72 overflow-y-auto scrollbar-thin">
              {countries.length > 0 ? countries.slice(0, 15).map((c: { country: string; total: number; blocked: number; block_rate: number }, idx: number) => {
                const pct = c.block_rate ?? 0
                const riskColor = pct >= 50 ? 'text-red-500' : pct >= 20 ? 'text-amber-500' : 'text-emerald-500'
                return (
                  <div key={c.country} className="flex items-center gap-2.5 py-2 hover:bg-muted/20 px-1 rounded transition-colors">
                    <span className="text-[10px] font-mono text-muted-foreground/60 w-5 text-right shrink-0">{idx + 1}</span>
                    <span className="text-base leading-none shrink-0">{getCountryFlag(c.country)}</span>
                    <span className="text-[12px] font-medium text-foreground flex-1 min-w-0 truncate">
                      {getCountryName(c.country)}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">{c.total.toLocaleString()}</span>
                    <span className={`text-[11px] font-bold shrink-0 w-12 text-right ${riskColor}`}>
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                )
              }) : (
                <p className="text-[12px] text-muted-foreground text-center py-8">No country data</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Bot Intelligence */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">Bot Intelligence</CardTitle>
            </div>
            <CardDescription className="text-[11px]">
              Top blocked user-agents from bot detection scoring
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="space-y-0 divide-y divide-border/40 max-h-72 overflow-y-auto scrollbar-thin">
              {bots.length > 0 ? bots.slice(0, 15).map((bot, idx) => (
                <div key={idx} className="flex items-start gap-2.5 py-2 hover:bg-muted/20 px-1 rounded transition-colors">
                  <span className="text-[10px] font-mono text-muted-foreground/60 w-5 text-right shrink-0 mt-0.5">{idx + 1}</span>
                  <p className="text-[11px] text-muted-foreground font-mono flex-1 min-w-0 leading-snug break-all line-clamp-2" title={bot.ua}>
                    {bot.ua}
                  </p>
                  <span className="text-[11px] font-semibold text-foreground shrink-0">{bot.count.toLocaleString()}</span>
                </div>
              )) : (
                <p className="text-[12px] text-muted-foreground text-center py-8">No bot data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
