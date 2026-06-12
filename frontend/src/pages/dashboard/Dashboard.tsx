import { useTrafficAnalytics, useTopThreats, useDashboardInsights, useWAFStats } from '@/hooks/useApi'
import { useTheme } from '@/contexts/ThemeContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PerformanceMetrics } from '@/components/shared/PerformanceMetrics'
import { WorldMap } from '@/components/shared/WorldMap'
import { StatCard } from '@/components/dashboard/StatCard'
import { LegendItem } from '@/components/dashboard/LegendItem'
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton'
import { getCountryName, getCountryFlag } from '@/lib/countries'
import {
  Shield, Activity, Globe, Lock, Zap,
  TrendingUp, MapPin, Cpu
} from 'lucide-react'
import { Line, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler, ArcElement
} from 'chart.js'
import { useState } from 'react'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, ArcElement)

export default function Dashboard() {
  const { theme } = useTheme()

  const chartColors = {
    grid:         theme === 'dark' ? '#1e2a38' : '#e8ecf0',
    text:         theme === 'dark' ? '#7a8fa8' : '#6b7a8d',
    tooltipBg:    theme === 'dark' ? '#1a2332' : '#ffffff',
    tooltipTitle: theme === 'dark' ? '#dde4ed' : '#1e2a38',
    tooltipBody:  theme === 'dark' ? '#7a8fa8' : '#5a6a7a',
    tooltipBorder:theme === 'dark' ? '#2a3a4a' : '#dde4ed',
    doughnut: (opacity: number) => [
      `rgba(107, 174, 245, ${opacity})`,  // hsl(217 85% 69%) — map blue (sidebar-active)
      `rgba(56, 152, 236, ${opacity})`,   // hsl(210 82% 57%) — mid blue
      `rgba(34, 182, 227, ${opacity})`,   // hsl(193 76% 51%) — sky-cyan
      `rgba(20, 200, 200, ${opacity})`,   // hsl(180 82% 43%) — teal
      `rgba(52, 211, 153, ${opacity})`,   // hsl(160 84% 52%) — emerald
      `rgba(99, 179, 237, ${opacity})`,   // hsl(205 75% 66%) — periwinkle blue
      `rgba(139, 200, 248, ${opacity})`,  // hsl(207 88% 76%) — pale blue
      `rgba(16, 185, 129, ${opacity})`,   // hsl(152 69% 40%) — green
    ],
  }

  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d'>(() => {
    const saved = localStorage.getItem('dashboard-time-range')
    return (saved === '1d' || saved === '7d' || saved === '30d') ? saved : '7d'
  })

  const [chartVisibility, setChartVisibility] = useState({ allow: true, challenge: true, block: true })

  const handleTimeRangeChange = (range: '1d' | '7d' | '30d') => {
    setTimeRange(range)
    localStorage.setItem('dashboard-time-range', range)
  }

  const toggleChartLine = (line: 'allow' | 'challenge' | 'block') => {
    setChartVisibility(prev => ({ ...prev, [line]: !prev[line] }))
  }

  const { data: analyticsData, isLoading: analyticsLoading } = useTrafficAnalytics(timeRange)
  const { data: threats } = useTopThreats(timeRange)
  const { data: insightsData } = useDashboardInsights(timeRange)
  const { data: wafStats } = useWAFStats(timeRange)

  const chartData = analyticsData?.data || []
  const stats = analyticsData?.summary || { total: 0, allow: 0, block: 0, block_waf: 0, block_bot: 0, challenge: 0 }

  const insights = {
    topIPs: (insightsData?.top_ips || []).map((i: { ip: string; count: number }) => [i.ip, i.count] as [string, number]),
    topHosts: (insightsData?.top_hosts || []).map((i: { host: string; count: number }) => [i.host, i.count] as [string, number]),
  }

  const geoInsights = {
    totalLogs: stats.total,
    topCountries: (insightsData?.top_countries || []).map((c: { country: string; total: number; blocked: number; block_rate: number }) => ({
      country: c.country, total: c.total, blocked: c.blocked, blockRate: c.block_rate,
    })),
    topProviders: (insightsData?.top_providers || []).map((p: { provider: string; total: number; blocked: number; block_rate: number }) => ({
      provider: p.provider, total: p.total, blocked: p.blocked, blockRate: p.block_rate,
    })),
  }

  const deviceInsights = {
    deviceTypes: (insightsData?.device_types || []).map((d: { device: string; count: number }) => ({ device: d.device, count: d.count })),
    operatingSystems: (insightsData?.os_types || []).map((o: { os: string; count: number }) => ({ os: o.os, count: o.count })),
  }

  if (analyticsLoading) return <DashboardSkeleton />

  //const blockRate = stats.total > 0 ? ((stats.block_waf + stats.block_bot) / stats.total) * 100 : 0

  return (
    <div className="space-y-6 animate-in">

      {/* ── Page header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted-foreground">
            Traffic analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
            {(['1d','7d','30d'] as const).map(r => (
              <button
                key={r}
                onClick={() => handleTimeRangeChange(r)}
                className={`px-3 py-1.5 text-[12px] font-semibold rounded-md transition-all ${
                  timeRange === r
                    ? 'btn-primary hover:opacity-90 shadow-none text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
      <PerformanceMetrics />

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Requests"
          value={stats.total}
          icon={<Activity className="w-4 h-4" />}
          variant="slate"
          description="All traffic"
        />
        <StatCard
          title="Blocked"
          value={stats.block}
          icon={<Lock className="w-4 h-4" />}
          variant="rose"
          percentage={stats.total > 0 ? (stats.block / stats.total) * 100 : 0}
          description="Score ≥ block threshold"
        />
        <StatCard
          title="Challenged"
          value={stats.challenge}
          icon={<Zap className="w-4 h-4" />}
          variant="amber"
          percentage={stats.total > 0 ? (stats.challenge / stats.total) * 100 : 0}
          description="Slider verification"
        />
        <StatCard
          title="WAF Contributed"
          value={(wafStats?.blocked || 0) + (wafStats?.challenged || 0)}
          icon={<Shield className="w-4 h-4" />}
          variant="slate"
          description="WAF score > 0"
        />
        <StatCard
          title="Clean Traffic"
          value={stats.allow}
          icon={<Shield className="w-4 h-4" />}
          variant="emerald"
          percentage={stats.total > 0 ? (stats.allow / stats.total) * 100 : 0}
          description="Verified requests"
        />
      </div>

      {/* ── Traffic chart ── */}
      <Card className="shadow-none border-border">
        <CardHeader className="px-5 py-4 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-[13px] font-semibold text-foreground">Traffic Distribution</CardTitle>
              <CardDescription className="text-[12px] mt-0.5">
                {timeRange === '1d' ? 'Hourly, last 24 hours' : timeRange === '7d' ? 'Daily — last 7 days' : 'Daily — last 30 days'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <LegendItem color="bg-emerald-500" label="Clean"     active={chartVisibility.allow}     onClick={() => toggleChartLine('allow')} />
              <LegendItem color="bg-amber-500" label="Challenge" active={chartVisibility.challenge} onClick={() => toggleChartLine('challenge')} />
              <LegendItem color="bg-rose-500" label="Block"     active={chartVisibility.block}     onClick={() => toggleChartLine('block')} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {chartData.length > 0 ? (
            <div style={{ height: 280 }}>
              <Line
                key={theme}
                data={{
                  labels: chartData.map(d => d.label),
                  datasets: [
                    {
                      label: 'Clean',
                      data: chartData.map(d => d.allow),
                      borderColor: theme === 'dark' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(5, 150, 105, 0.6)',
                      backgroundColor: theme === 'dark' ? 'rgba(16,185,129,0.05)' : 'rgba(5,150,105,0.05)',
                      borderWidth: 2,
                      fill: true,
                      tension: 0.4,
                      pointRadius: 3,
                      pointHoverRadius: 5,
                      pointBackgroundColor: theme === 'dark' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(5, 150, 105, 0.6)',
                      hidden: !chartVisibility.allow,
                    },
                    {
                      label: 'Challenge',
                      data: chartData.map(d => d.challenge),
                      borderColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(217, 119, 6, 0.6)',
                      backgroundColor: theme === 'dark' ? 'rgba(245,158,11,0.05)' : 'rgba(217,119,6,0.05)',
                      borderWidth: 2,
                      fill: true,
                      tension: 0.4,
                      pointRadius: 3,
                      pointHoverRadius: 5,
                      pointBackgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(217, 119, 6, 0.6)',
                      hidden: !chartVisibility.challenge,
                    },
                    {
                      label: 'Block',
                      data: chartData.map(d => d.block),
                      borderColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(220, 38, 38, 0.6)',
                      backgroundColor: theme === 'dark' ? 'rgba(239,68,68,0.05)' : 'rgba(220,38,38,0.05)',
                      borderWidth: 2,
                      fill: true,
                      tension: 0.4,
                      pointRadius: 3,
                      pointHoverRadius: 5,
                      pointBackgroundColor: theme === 'dark' ? 'rgba(239, 68, 68, 0.6)' : 'rgba(220, 38, 38, 0.6)',
                      hidden: !chartVisibility.block,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  scales: {
                    x: {
                      grid: { display: false },
                      ticks: { font: { size: 11 }, color: chartColors.text },
                      border: { display: false },
                    },
                    y: {
                      beginAtZero: true,
                      grid: { color: chartColors.grid },
                      ticks: { font: { size: 11 }, color: chartColors.text },
                      border: { display: false },
                    },
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      backgroundColor: chartColors.tooltipBg,
                      titleColor: chartColors.tooltipTitle,
                      bodyColor: chartColors.tooltipBody,
                      borderColor: chartColors.tooltipBorder,
                      borderWidth: 1,
                      padding: 10,
                      boxPadding: 5,
                      usePointStyle: true,
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Activity className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-[13px] font-medium text-foreground">No traffic data</p>
              <p className="text-[12px] text-muted-foreground mt-1">Data appears once traffic is logged</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Insights row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Top IPs */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">Top Source IPs</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="space-y-2.5 max-h-72 overflow-y-auto scrollbar-thin pr-1">
              {insights.topIPs.length > 0 ? insights.topIPs.map(([ip, count]: [string, number]) => (
                <div key={ip} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Globe className="w-3.5 h-3.5 icon-neutral shrink-0" />
                    <span className="text-[12px] font-mono text-foreground truncate">{ip}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground shrink-0">{count} req</span>
                </div>
              )) : (
                <p className="text-[12px] text-muted-foreground text-center py-6">No data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* App Distribution */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">App Distribution</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin pr-1">
              {insights.topHosts.length > 0 ? insights.topHosts.map(([host, count]: [string, number]) => (
                <div key={host} className="space-y-1">
                  <div className="flex justify-between text-[11px] font-medium text-muted-foreground">
                    <span className="truncate max-w-[160px]">{host}</span>
                    <span>{stats.total > 0 ? ((count / stats.total) * 100).toFixed(0) : 0}%</span>
                  </div>
                  <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )) : (
                <p className="text-[12px] text-muted-foreground text-center py-6">No data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top ISPs */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">Top ISP / Providers</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin pr-1">
              {geoInsights.topProviders.length > 0 ? geoInsights.topProviders.map(({ provider, total, blockRate }: { provider: string; total: number; blockRate: number }, idx: number) => (
                <div key={provider} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">{provider}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{total} requests</span>
                      {blockRate > 0 && (
                        <span className="text-[10px] font-medium text-muted-foreground">
                          · {blockRate.toFixed(1)}% blocked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-[12px] text-muted-foreground text-center py-6">No provider data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Geo section ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 icon-neutral" />
          <h2 className="text-[13px] font-semibold text-foreground">Geographic</h2>
          <div className="flex-1 h-px bg-border ml-2" />
        </div>

        {/* Top Countries with World Map */}
        <Card className="shadow-none border-border">
          <CardHeader className="px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 icon-neutral" />
              <CardTitle className="text-[13px] font-semibold">Top Countries</CardTitle>
            </div>
            <CardDescription className="text-[11px]">Request distribution by location</CardDescription>
          </CardHeader>
          <CardContent className="px-4 py-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* World Map Visualization - 2/3 width */}
              <div className="lg:col-span-2 flex items-center justify-center bg-muted/20 rounded-lg overflow-hidden min-h-[360px]">
                {analyticsLoading ? (
                  <div className="w-full h-full min-h-[360px] bg-muted/30 animate-pulse rounded-lg" />
                ) : geoInsights.topCountries.length > 0 ? (
                  <WorldMap countryData={geoInsights.topCountries} />
                ) : (
                  <div className="text-center">
                    <Globe className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-[12px] text-muted-foreground">No geographic data</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Data appears once traffic is logged</p>
                  </div>
                )}
              </div>
              
              {/* Countries List - 1/3 width with inner card */}
              <div className="lg:col-span-1 flex flex-col min-h-[360px]">
                <Card className="shadow-none border-border flex flex-col flex-1">
                  <CardHeader className="px-3 py-2.5 border-b border-border shrink-0">
                    <CardTitle className="text-[12px] font-semibold">Countries</CardTitle>
                  </CardHeader>
                  <CardContent className="px-3 py-2.5 flex-1 overflow-hidden">
                    <div className="space-y-2 h-full overflow-y-auto scrollbar-thin pr-1">
                      {analyticsLoading ? (
                        <div className="space-y-2 py-2">
                          {[...Array(5)].map((_, i) => (
                            <div key={i} className="space-y-1">
                              <div className="h-3 w-full bg-muted rounded animate-pulse" />
                              <div className="h-1 w-full bg-muted/50 rounded animate-pulse" />
                            </div>
                          ))}
                        </div>
                      ) : geoInsights.topCountries.length > 0 ? geoInsights.topCountries.map(({ country, total }: { country: string; total: number }) => (
                        <div key={country} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm leading-none">{getCountryFlag(country)}</span>
                              <span className="text-[11px] font-medium text-foreground truncate">{getCountryName(country)}</span>
                            </div>
                            <span className="text-[10px] font-semibold text-muted-foreground shrink-0">{total}</span>
                          </div>
                          <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${geoInsights.totalLogs > 0 ? (total / geoInsights.totalLogs) * 100 : 0}%` }} />
                          </div>
                        </div>
                      )) : (
                        <p className="text-[12px] text-muted-foreground text-center py-6">No geo data yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Client analytics ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Top Threats */}
          <Card className="shadow-none border-border">
            <CardHeader className="px-4 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 icon-neutral" />
                <CardTitle className="text-[13px] font-semibold">Top Threats</CardTitle>
              </div>
              <CardDescription className="text-[11px]">Threat distribution by type</CardDescription>
            </CardHeader>
            <CardContent className="px-4 py-3">
              {threats && threats.length > 0 ? (
                <div className="space-y-3">
                  {threats.map((threat) => {
                    const total = threats.reduce((sum, t) => sum + t.count, 0)
                    const pct = total > 0 ? (threat.count / total) * 100 : 0
                    const displayName = threat.category === 'bot_detection' ? 'Bot Detection' :
                                       threat.category === 'waf_rule' ? 'WAF Rule' :
                                       threat.category === 'custom_rule' ? 'Custom Rule' :
                                       threat.category === 'rate_limit' ? 'Rate Limit' :
                                       threat.category === 'ip_reputation' ? 'IP Reputation' :
                                       threat.category === 'ip_access' ? 'IP Access Rule' :
                                       threat.category === 'protocol_anomaly' ? 'Protocol Anomaly' :
                                       threat.category === 'block_unknown' ? 'Unknown Block' :
                                       threat.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                    const barColor = threat.category === 'bot_detection' ? 'bg-blue-500' :
                                    threat.category === 'waf_rule' ? 'bg-rose-500' :
                                    threat.category === 'custom_rule' ? 'bg-violet-500' :
                                    threat.category === 'rate_limit' ? 'bg-orange-500' :
                                    threat.category === 'ip_reputation' ? 'bg-cyan-500' :
                                    threat.category === 'ip_access' ? 'bg-red-500' :
                                    threat.category === 'protocol_anomaly' ? 'bg-amber-500' :
                                    'bg-slate-500'
                    return (
                      <div key={threat.category} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-medium text-foreground">{displayName}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground">{threat.count}</span>
                            <span className="text-[10px] font-semibold text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground text-center py-6">No threats detected</p>
              )}
            </CardContent>
          </Card>

          {/* Device Types */}
          <Card className="shadow-none border-border">
            <CardHeader className="px-4 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 icon-neutral" />
                <CardTitle className="text-[13px] font-semibold">Device Types</CardTitle>
              </div>
              <CardDescription className="text-[11px]">Desktop, mobile, tablet distribution</CardDescription>
            </CardHeader>
            <CardContent className="px-4 py-3">
              {deviceInsights.deviceTypes.length > 0 ? (
                <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Doughnut
                    data={{
                      labels: deviceInsights.deviceTypes.map(({ device }: { device: string }) => device.charAt(0).toUpperCase() + device.slice(1)),
                      datasets: [{
                        data: deviceInsights.deviceTypes.map(({ count }: { count: number }) => count),
                        backgroundColor: chartColors.doughnut(theme === 'dark' ? 0.8 : 0.7),
                        borderColor: theme === 'dark' ? '#141e2b' : '#ffffff',
                        borderWidth: 2,
                        hoverOffset: 4,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '65%',
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            font: { size: 11 },
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
                          padding: 10,
                          callbacks: {
                            label: (context) => {
                              const value = context.parsed
                              const total = deviceInsights.deviceTypes.reduce((sum: number, { count }: { count: number }) => sum + count, 0)
                              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
                              return `${context.label}: ${value} (${percentage}%)`
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground text-center py-6">No device data yet</p>
              )}
            </CardContent>
          </Card>

          {/* Operating Systems */}
          <Card className="shadow-none border-border">
            <CardHeader className="px-4 py-3.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 icon-neutral" />
                <CardTitle className="text-[13px] font-semibold">Operating Systems</CardTitle>
              </div>
              <CardDescription className="text-[11px]">Windows, Android, iOS, Linux distribution</CardDescription>
            </CardHeader>
            <CardContent className="px-4 py-3">
              {deviceInsights.operatingSystems.length > 0 ? (
                <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Doughnut
                    data={{
                      labels: deviceInsights.operatingSystems.map(({ os }: { os: string }) => os.charAt(0).toUpperCase() + os.slice(1)),
                      datasets: [{
                        data: deviceInsights.operatingSystems.map(({ count }: { count: number }) => count),
                        backgroundColor: chartColors.doughnut(theme === 'dark' ? 0.8 : 0.7),
                        borderColor: theme === 'dark' ? '#141e2b' : '#ffffff',
                        borderWidth: 2,
                        hoverOffset: 4,
                      }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '65%',
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: {
                            font: { size: 11 },
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
                          padding: 10,
                          callbacks: {
                            label: (context) => {
                              const value = context.parsed
                              const total = deviceInsights.operatingSystems.reduce((sum: number, { count }: { count: number }) => sum + count, 0)
                              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0
                              return `${context.label}: ${value} (${percentage}%)`
                            },
                          },
                        },
                      },
                    }}
                  />
                </div>
              ) : (
                <p className="text-[12px] text-muted-foreground text-center py-6">No OS data yet</p>
              )}
            </CardContent>
          </Card>
        </div>



    </div>
  )
}
