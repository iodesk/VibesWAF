import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLogs, useApps } from '@/hooks/useApi'
import type { LogEntry } from '@/lib/api/types'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, Activity, GitBranch, X, ArrowRight, Copy, Check, Search, ChevronDown } from 'lucide-react'

interface StageTrace {
  stage: string
  result?: string
  score?: number
  multiplier?: number
  final_score?: number
  reason?: string
  evidence?: any
  rule_id?: string
}

interface RequestMetadata {
  ip: string
  method: string
  path: string
  host: string
  user_agent?: string
  ja4?: string
  ja4h?: string
  ja4h_ua_hash?: string
  actual_ua_hash?: string
  ua_match?: boolean
  http_fingerprint?: string
}

interface PipelineTrace {
  phase: string
  decision: string
  score?: number
  request?: RequestMetadata
  stages: StageTrace[]
}

function parsePipelineTrace(raw: string): PipelineTrace | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as PipelineTrace
  } catch {
    return null
  }
}

function stageLabel(stage: string): string {
  const labels: Record<string, string> = {
    challenge_validator: 'Challenge Validator',
    ip_access_rule: 'IP Access Rule',
    rate_limit: 'Rate Limit',
    flood: 'Flood Protection',
    decision_cache: 'Security Rules Cache',
    custom_rules: 'Custom Rules',
    ip_reputation: 'IP Reputation',
    bot_detection: 'Bot Detection',
    waf_anomaly: 'WAF / OWASP CRS',
    protocol_anomaly: 'Protocol Anomaly',
    trusted_history: 'Trusted History',
    trust: 'Trust Reduction',
    stable_session: 'Stable Session',
  }
  return labels[stage] || stage
}

function resultColor(result?: string, score?: number): string {
  if (result === 'BLOCK') return 'text-red-500'
  if (result === 'CHALLENGE') return 'text-amber-500'
  if (result === 'ALLOW' || result === 'VERIFIED' || result === 'PASS') return 'text-emerald-500'
  if (result === 'SKIP') return 'text-muted-foreground'
  if (result === 'MISS' || result === 'NO_MATCH' || result === 'NO_COOKIE') return 'text-muted-foreground'
  if (result === 'NEW') return 'text-blue-400'
  if (result === 'CHANGED') return 'text-muted-foreground'
  if (result === 'PENDING') return 'text-muted-foreground'
  if (result === 'HIT') return 'text-blue-400'
  if (score !== undefined && score > 0) return 'text-amber-400'
  return 'text-muted-foreground'
}

function FingerprintSection({ request }: { request: RequestMetadata }) {
  const [expanded, setExpanded] = useState(false)

  if (!request) return null

  const hasData = request.ja4 || request.ja4h || request.http_fingerprint || request.ja4h_ua_hash || request.actual_ua_hash
  if (!hasData) return null

  return (
    <div className="mb-3">
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="text-xs">&#128273;</span>
        <span>Fingerprint</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-1 pl-4 text-[10px] font-mono">
          {request.ja4 && (
            <div className="flex gap-2">
              <span className="text-muted-foreground/60 shrink-0">JA4:</span>
              <span className="text-foreground truncate" title={request.ja4}>{request.ja4}</span>
            </div>
          )}
          {request.ja4h && (
            <div className="flex gap-2">
              <span className="text-muted-foreground/60 shrink-0">JA4H:</span>
              <span className="text-foreground truncate" title={request.ja4h}>{request.ja4h}</span>
            </div>
          )}
          {request.http_fingerprint && (
            <div className="flex gap-2">
              <span className="text-muted-foreground/60 shrink-0">HTTP:</span>
              <span className="text-foreground truncate" title={request.http_fingerprint}>{request.http_fingerprint}</span>
            </div>
          )}
          {(request.ja4h_ua_hash || request.actual_ua_hash) && (
            <div className="mt-1.5 pt-1.5 border-t border-border/50">
              <div className="text-[9px] text-muted-foreground/60 mb-1">UA Hash Comparison</div>
              <div className="flex gap-2 items-center">
                <span className="text-muted-foreground/60 shrink-0">JA4H UA:</span>
                <span className="text-foreground truncate" title={request.ja4h_ua_hash}>{request.ja4h_ua_hash || '-'}</span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-muted-foreground/60 shrink-0">Actual UA:</span>
                <span className="text-foreground truncate" title={request.actual_ua_hash}>{request.actual_ua_hash || '-'}</span>
              </div>
              {request.ua_match !== undefined && (
                <div className="flex gap-2 items-center mt-1">
                  <span className="text-muted-foreground/60 shrink-0">Match:</span>
                  <span className={request.ua_match ? 'text-emerald-500' : 'text-red-500'}>
                    {request.ua_match ? 'YES' : 'MISMATCH'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


function decisionBadgeClass(decision: string): string {
  if (decision === 'block') return 'bg-red-500/10 text-red-500 border-red-500/20'
  if (decision === 'challenge') return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
  if (decision === 'allow') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
  return 'bg-muted text-muted-foreground border-border'
}

function PipelineDrawer({ log, onClose }: { log: LogEntry; onClose: () => void }) {
  const raw = log.pipeline_trace
  const trace = raw ? parsePipelineTrace(raw) : null

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div className="w-[440px] border-l border-border flex flex-col shadow-2xl" style={{ backgroundColor: 'hsl(var(--color-card))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Pipeline Trace</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Request summary */}
        <div className="px-4 py-3 border-b border-border shrink-0 space-y-1" style={{ backgroundColor: 'hsl(var(--color-muted) / 0.3)' }}>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-mono">{log.ip}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
            <span className="text-foreground font-mono truncate">{log.host}{log.path}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{format(new Date(log.ts), 'yyyy-MM-dd HH:mm:ss')}</span>
            {log.country && <span className="text-[10px] text-muted-foreground">· {log.country}</span>}
            {log.latency !== undefined && <span className="text-[10px] text-muted-foreground">· {log.latency}ms{log.pipeline_latency > 0 && ` (engine: ${log.pipeline_latency}ms`}{log.upstream_latency > 0 && ` · upstream: ${log.upstream_latency}ms`}{log.pipeline_latency > 0 && ')'}</span>}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {!trace ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <GitBranch className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">No trace available</p>
              <p className="text-xs mt-1">Trace is recorded for requests after migration</p>
            </div>
          ) : (
            <>
              {/* Decision summary */}
              <div className="flex items-center gap-3">
                <div className={`px-2.5 py-1 rounded border text-[11px] font-bold uppercase tracking-wide ${decisionBadgeClass(trace.decision)}`}>
                  {trace.decision}
                </div>
                <div className="text-xs text-muted-foreground">
                  Phase: <span className="text-foreground font-medium">{trace.phase}</span>
                </div>
                {trace.score !== undefined && trace.score > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Score: <span className="text-foreground font-mono font-semibold">{trace.score}</span>
                    <span className="text-muted-foreground">/100</span>
                  </div>
                )}
              </div>

              {/* Score bar */}
              {trace.score !== undefined && trace.phase === 'SCORING' && (
                <div className="space-y-1">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${trace.score >= 80 ? 'bg-red-500' : trace.score >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(trace.score, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0</span>
                    <span className="text-amber-500">50 challenge</span>
                    <span className="text-red-500">80 block</span>
                    <span>100</span>
                  </div>
                </div>
              )}

              {/* Stages — timeline */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">Stages</p>
                <div className="flex flex-col">
                  {trace.stages.map((stage, i) => {
                    const isLast = i === trace.stages.length - 1
                    const isTriggered = (stage.score !== undefined && stage.score !== 0) ||
                      stage.result === 'BLOCK' || stage.result === 'CHALLENGE'
                    const isSkipped = stage.result === 'SKIP'
                    const isTerminal = stage.result === 'BLOCK' || stage.result === 'CHALLENGE'

                    const dotSize = isTriggered ? 'w-2.5 h-2.5' : 'w-2 h-2'
                    const dotColor = isTerminal
                      ? (stage.result === 'BLOCK' ? 'bg-red-500' : 'bg-amber-500')
                      : isTriggered
                        ? (stage.score !== undefined && stage.score < 0 ? 'bg-emerald-500' : 'bg-amber-400')
                        : isSkipped
                          ? 'bg-border'
                          : 'bg-muted-foreground/30'
                    const dotRing = isTriggered && !isTerminal
                      ? 'ring-2 ring-amber-400/30'
                      : isTerminal
                        ? (stage.result === 'BLOCK' ? 'ring-2 ring-red-500/30' : 'ring-2 ring-amber-500/30')
                        : ''

                    return (
                      <div key={i} className="flex gap-3">
                        <div className="flex flex-col items-center" style={{ width: '16px', minWidth: '16px' }}>
                          <div className={`rounded-full shrink-0 mt-[14px] ${dotSize} ${dotColor} ${dotRing}`} />
                          {!isLast && (
                            <div
                              className="w-px flex-1 mt-1"
                              style={{
                                minHeight: '12px',
                                backgroundColor: isSkipped ? 'hsl(var(--color-border) / 0.4)' : 'hsl(var(--color-border))'
                              }}
                            />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 pb-3">
                          <div
                            className={`flex items-center justify-between gap-2 py-1.5 px-2 rounded-md transition-colors
                              ${isSkipped ? 'opacity-50' : 'hover:bg-muted/40'}`}
                          >
                            <span className={`text-xs font-medium ${isSkipped ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {stageLabel(stage.stage)}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {stage.score !== undefined && stage.score !== 0 && (
                                <span className={`text-[10px] font-mono font-bold ${stage.score > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {stage.score > 0 ? '+' : ''}{stage.score}
                                  {stage.multiplier !== undefined && stage.multiplier !== 0 && stage.multiplier !== 1 && (
                                    <span className="text-muted-foreground font-normal"> ×{stage.multiplier}</span>
                                  )}
                                  {stage.final_score !== undefined && stage.final_score !== stage.score && (
                                    <span className="text-foreground"> = {stage.final_score}</span>
                                  )}
                                </span>
                              )}
                              {stage.result && (
                                <span className={`text-[10px] font-semibold uppercase tracking-wide ${resultColor(stage.result, stage.score)}`}>
                                  {stage.result}
                                </span>
                              )}
                            </div>
                          </div>
                          {stage.reason && (
                            <div className="px-2 pb-1">
                              <p className="text-[11px] text-muted-foreground leading-relaxed">{stage.reason}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Fingerprint section */}
              {trace.request && <FingerprintSection request={trace.request} />}

              {/* Raw JSON toggle */}
              <RawJSON raw={raw!} />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function RawJSON({ raw }: { raw: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(JSON.stringify(JSON.parse(raw), null, 2)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] text-muted-foreground hover:bg-muted/40 transition-colors"
      >
        <span className="font-medium">Raw JSON</span>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <>
          <div className="flex justify-end px-3 pt-2" style={{ backgroundColor: 'hsl(var(--color-muted) / 0.2)' }}>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="px-3 py-2 text-[10px] font-mono text-muted-foreground overflow-auto max-h-60 leading-relaxed" style={{ backgroundColor: 'hsl(var(--color-muted) / 0.2)' }}>
            {JSON.stringify(JSON.parse(raw), null, 2)}
          </pre>
        </>
      )}
    </div>
  )
}

export default function Logs() {
  const [actionFilter, setActionFilter] = useState<'allow' | 'block' | 'challenge' | undefined>()
  const [appFilter, setAppFilter] = useState<string | undefined>()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null)
  const limit = 100

  const { data: apps } = useApps()
  const offset = (page - 1) * limit
  const { data: logsResponse, isLoading } = useLogs({ limit, offset, action: actionFilter, app_id: appFilter, q: debouncedSearch || undefined })

  const logs = logsResponse?.data || []
  const totalCount = logsResponse?.total || 0
  const totalPages = Math.ceil(totalCount / limit)

  useEffect(() => { setPage(1) }, [actionFilter, appFilter, debouncedSearch])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const actionBadge = (action: string) => {
    if (action === 'block') return 'text-red-500'
    if (action === 'challenge_solved') return 'text-emerald-600'
    if (action === 'challenge' || action === 'challenge_failed') return 'text-amber-500'
    return 'text-green-500'
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-in">
        <div className="h-5 w-24 bg-muted rounded animate-pulse" />
        <div className="border border-border rounded-lg overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-border last:border-0">
              {[...Array(6)].map((_, j) => (
                <div key={j} className="h-3.5 flex-1 bg-muted/60 rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-4 animate-in">
      {selectedLog && (
        <PipelineDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-base font-bold text-foreground">Security Logs</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Real-time security events · auto-refresh 5s</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search IP, host, path, UA..."
              className="h-8 pl-8 pr-3 w-56 rounded border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring outline-none"
            />
          </div>
          <select
            value={appFilter || ''}
            onChange={(e) => setAppFilter(e.target.value || undefined)}
            className="h-8 px-2.5 rounded border border-border bg-background text-xs text-foreground focus:ring-1 focus:ring-ring outline-none"
          >
            <option value="">All Applications</option>
            {apps?.map((app) => (
              <option key={app.id} value={app.id}>{app.domain}</option>
            ))}
          </select>
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded border border-border">
            {([undefined, 'allow', 'block', 'challenge'] as const).map((f) => (
              <button
                key={String(f)}
                onClick={() => setActionFilter(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  actionFilter === f
                    ? 'btn-primary hover:opacity-90 shadow-none text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === undefined ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 flex flex-col border border-border rounded-lg overflow-hidden bg-card min-h-0">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted shrink-0">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{logs.length} events</span>
            {totalCount > 0 && <span className="text-xs text-muted-foreground">of {totalCount}</span>}
          </div>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin">
          {logs.length > 0 ? (
            <table className="w-full text-xs table-fixed">
              <colgroup>
                <col style={{ width: '32px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '110px' }} />
                <col style={{ width: '140px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '70px' }} />
                <col style={{ width: '120px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '180px' }} />
                <col style={{ width: '130px' }} />
                <col style={{ width: '60px' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '180px' }} />
              </colgroup>
              <thead className="sticky top-0 bg-background border-b border-border z-10">
                <tr>
                  <th className="text-left px-2 py-2.5 font-semibold text-muted-foreground whitespace-nowrap" title="Pipeline trace">Raw</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Time</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">App</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Host</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">IP</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Country</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">ASN</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Device</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">OS</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">UA</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Reason</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap w-[130px]">Action</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logs.map((log, idx) => {
                  const truncateIP = (ip: string) => {
                    if (ip.includes(':')) {
                      const parts = ip.split(':')
                      if (parts.length > 4) {
                        return `${parts.slice(0, 3).join(':')}:...`
                      }
                    }
                    return ip
                  }

                  const hasTrace = !!log.pipeline_trace

                  return (
                    <tr key={idx} className="hover:bg-muted/30 transition-colors">
                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className={`p-1 rounded hover:bg-muted transition-colors ${hasTrace ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/30 cursor-default'}`}
                          title={hasTrace ? 'View pipeline trace' : 'No trace available'}
                        >
                          <GitBranch className="w-3 h-3" />
                        </button>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.ts), 'HH:mm:ss')}
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground truncate" title={log.app_id}>
                        <div className="truncate">{log.app_id || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-foreground truncate" title={log.host}>
                        <div className="truncate">{log.host || '—'}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-foreground truncate" title={log.ip}>
                        <div className="truncate">{truncateIP(log.ip)}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{log.country || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate" title={log.asn_org}>
                        <div className="truncate">{log.asn_org || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate" title={log.device_type}>
                        <div className="truncate">{log.device_type || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate" title={log.os}>
                        <div className="truncate">{log.os || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate" title={log.ua}>
                        <div className="truncate">{log.ua || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate" title={log.reason}>
                        <div className="truncate">{log.reason || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{log.status}</td>
                      <td className="px-3 py-2 whitespace-nowrap min-w-[130px]">
                        <span className={`text-[10px] font-bold uppercase tracking-wide ${actionBadge(log.action)}`}>
                          {log.action === 'challenge_solved' ? 'solved' : log.action === 'challenge_failed' ? 'failed' : log.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-muted-foreground truncate" title={log.path}>
                        <div className="truncate">{log.path}</div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
              <Activity className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-sm font-medium text-foreground">No events found</p>
              <p className="text-xs mt-1">Events will appear here as traffic is processed</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted shrink-0">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 px-2">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-bold text-foreground px-2">{page}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="h-7 px-2">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
