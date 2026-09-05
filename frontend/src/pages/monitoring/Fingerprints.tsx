import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Fingerprint, Search, FileText, FileJson, X, Clock, Copy, Check } from 'lucide-react'
import { useJA4Fingerprints, useJA4Detail } from '@/hooks/useApi'
import { wafApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

function timeAgo(dateStr: string): string {
  if (!dateStr) return '-'
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  if (isNaN(then)) return dateStr
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handleCopy} className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground transition-colors" title="Copy">
      {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
    </button>
  )
}

function DetailDrawer({ ja4, onClose }: { ja4: string; onClose: () => void }) {
  const { data: detail, isLoading } = useJA4Detail(ja4)

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={onClose} />

      {/* Drawer panel */}
      <div className="w-[440px] border-l border-border flex flex-col shadow-2xl" style={{ backgroundColor: 'hsl(var(--color-card))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Fingerprint Detail</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Summary bar */}
        {detail && (
          <div className="px-4 py-3 border-b border-border shrink-0" style={{ backgroundColor: 'hsl(var(--color-muted) / 0.3)' }}>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-foreground font-mono truncate" title={detail.ja4}>{detail.ja4}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[11px] text-muted-foreground">{detail.count.toLocaleString()} requests</span>
              <span className="text-[11px] text-muted-foreground">· {detail.unique_ips} unique IPs</span>
              {detail.ua_match && <span className="text-[11px] text-emerald-500">· UA Match</span>}
              {!detail.ua_match && <span className="text-[11px] text-red-500">· UA Mismatch</span>}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            </div>
          ) : detail ? (
            <>
              {/* Identifiers */}
              <Section>
                <SectionTitle>Identifiers</SectionTitle>
                <div className="space-y-1.5">
                  <FieldRow label="JA4" value={detail.ja4} />
                  {detail.ja4h && <FieldRow label="JA4H" value={detail.ja4h} />}
                  {detail.http_fingerprint && <FieldRow label="HTTP FP" value={detail.http_fingerprint} />}
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="w-16 shrink-0 text-muted-foreground/60">Match</span>
                    <span className={detail.ua_match ? 'text-emerald-500 font-medium' : 'text-red-500 font-medium'}>
                      {detail.ua_match ? 'YES' : 'MISMATCH'}
                    </span>
                  </div>
                </div>
              </Section>

              {/* Statistics */}
              <Section>
                <SectionTitle>Statistics</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  <StatCard label="Requests" value={detail.count.toLocaleString()} />
                  <StatCard label="Unique IPs" value={detail.unique_ips.toLocaleString()} />
                  <StatCard label="First Seen" value={detail.first_seen} />
                  <StatCard label="Last Seen" value={detail.last_seen} />
                </div>
              </Section>

              {/* User Agents */}
              {detail.top_ua?.length > 0 && (
                <Section>
                  <SectionTitle>User Agents</SectionTitle>
                  <div className="space-y-1">
                    {detail.top_ua.map((ua, i) => (
                      <div key={i} className="text-[11px] font-mono text-foreground/80 bg-muted/30 rounded px-2.5 py-1.5 break-all" title={ua}>
                        {ua}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Top Paths */}
              {detail.top_paths?.length > 0 && (
                <Section>
                  <SectionTitle>Top Paths</SectionTitle>
                  <div className="space-y-1">
                    {detail.top_paths.map((path, i) => (
                      <div key={i} className="text-[11px] font-mono text-foreground/80 bg-muted/30 rounded px-2.5 py-1.5" title={path}>
                        {path}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Top Hosts */}
              {detail.top_hosts?.length > 0 && (
                <Section>
                  <SectionTitle>Top Hosts</SectionTitle>
                  <div className="space-y-1">
                    {detail.top_hosts.map((host, i) => (
                      <div key={i} className="text-[11px] font-mono text-foreground/80 bg-muted/30 rounded px-2.5 py-1.5" title={host}>
                        {host}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Top IPs */}
              {detail.top_ips?.length > 0 && (
                <Section>
                  <SectionTitle>Top IPs</SectionTitle>
                  <div className="space-y-1">
                    {detail.top_ips.map((ip, i) => (
                      <div key={i} className="text-[11px] font-mono text-foreground/80 bg-muted/30 rounded px-2.5 py-1.5" title={ip}>
                        {ip}
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Fingerprint className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-[12px]">Fingerprint not found</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2 pt-4 border-t border-border/50 first:border-0 first:pt-0">{children}</div>
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{children}</h3>
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[11px]">
      <span className="w-16 shrink-0 text-muted-foreground/60 font-mono">{label}:</span>
      <span className="font-mono text-foreground break-all flex-1">{value}</span>
      <CopyButton text={value} />
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded px-2.5 py-1.5">
      <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{label}</div>
      <div className="text-[12px] font-mono font-semibold text-foreground mt-0.5">{value}</div>
    </div>
  )
}

export default function Fingerprints() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedJA4, setSelectedJA4] = useState<string | null>(null)
  const limit = 100

  const { data, isLoading } = useJA4Fingerprints(limit, page * limit)
  const entries = data?.data ?? []
  const total = data?.total ?? 0

  const filtered = search
    ? entries.filter((e) => e.ja4.toLowerCase().includes(search.toLowerCase()))
    : entries

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Fingerprint className="w-5 h-5 icon-neutral" />
            <h1 className="text-lg font-semibold text-foreground">JA4 Fingerprints</h1>
          </div>
          <p className="text-[13px] text-muted-foreground mt-1">
            Top {limit} TLS fingerprints by request volume
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search JA4..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 rounded border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring outline-none w-64"
            />
          </div>
          <button
            onClick={() => { window.location.href = wafApi.analytics.exportJA4Fingerprints('csv') }}
            className="h-8 px-2.5 rounded border border-border bg-background text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => { window.location.href = wafApi.analytics.exportJA4Fingerprints('json') }}
            className="h-8 px-2.5 rounded border border-border bg-background text-xs text-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
          >
            <FileJson className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-none border-border">
        <CardHeader className="px-4 py-3.5 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-[13px] font-semibold">JA4 Database</CardTitle>
              <CardDescription className="text-[11px]">
                {total.toLocaleString()} unique fingerprints collected all-time
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-12">#</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">JA4</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Top User Agent</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Requests</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Unique IPs</th>
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((entry, idx) => (
                    <tr
                      key={entry.ja4}
                      onClick={() => setSelectedJA4(entry.ja4)}
                      className="hover:bg-muted/20 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-2.5 text-[11px] font-mono text-muted-foreground/60">
                        {page * limit + idx + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[12px] font-mono text-foreground" title={entry.ja4}>
                          {entry.ja4.length > 40 ? entry.ja4.slice(0, 37) + '...' : entry.ja4}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] text-muted-foreground" title={entry.top_ua}>
                          {entry.top_ua ? (entry.top_ua.length > 45 ? entry.top_ua.slice(0, 42) + '...' : entry.top_ua) : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-[12px] font-mono font-semibold text-foreground">
                          {entry.count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-[12px] font-mono text-foreground">
                          {entry.unique_ips.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {timeAgo(entry.last_seen)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Fingerprint className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-[12px]">{search ? 'No fingerprints match your search' : 'No fingerprint data yet'}</p>
            </div>
          )}

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground">
                Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total.toLocaleString()}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 px-3 rounded border border-border bg-background text-xs text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(Math.ceil(total / limit) - 1, p + 1))}
                  disabled={(page + 1) * limit >= total}
                  className="h-7 px-3 rounded border border-border bg-background text-xs text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      {selectedJA4 && (
        <DetailDrawer ja4={selectedJA4} onClose={() => setSelectedJA4(null)} />
      )}
    </div>
  )
}
