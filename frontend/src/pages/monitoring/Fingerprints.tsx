import { useState } from 'react'
import { Fingerprint, ChevronLeft, ChevronRight, Search, FileText, FileJson } from 'lucide-react'
import { useJA4Fingerprints } from '@/hooks/useApi'
import { wafApi } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function Fingerprints() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const limit = 30

  const { data, isLoading } = useJA4Fingerprints(limit, page * limit)
  const entries = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / limit)

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
            Unique TLS fingerprints collected from all requests
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
                    <th className="px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filtered.map((entry, idx) => (
                    <tr key={entry.ja4} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-[11px] font-mono text-muted-foreground/60">
                        {page * limit + idx + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[12px] font-mono text-foreground break-all" title={entry.ja4}>
                          {entry.ja4}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-[12px] font-mono font-semibold text-foreground">
                          {entry.count.toLocaleString()}
                        </span>
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
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-[11px] text-muted-foreground">
                Page {page + 1} of {totalPages} ({total.toLocaleString()} total)
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 px-2 rounded border border-border bg-background text-xs text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-7 px-2 rounded border border-border bg-background text-xs text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-muted transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
