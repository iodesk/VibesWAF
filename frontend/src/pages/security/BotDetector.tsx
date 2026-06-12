import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield, Plus, SquarePen, Trash2, CheckCircle2, Search, ChevronLeft, ChevronRight, Globe, Save, RefreshCw, Network } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useBotPatterns, useCreateBotPattern, useUpdateBotPattern, useDeleteBotPattern, useBulkDeleteBotPatterns, useBotConfig, useUpdateBotConfig, useBotIPRanges, useCreateBotIPRange, useUpdateBotIPRange, useDeleteBotIPRange, useSyncBotIPRange, useTopBlockedBots } from '@/hooks/useApi'
import { useToast } from '@/components/ui/toast'
import type { BotPattern, BotPatternRequest, BotConfig, BotIPRange, BotIPRangeRequest } from '@/lib/api-client'

export default function BotDetector() {
  const { data: patterns, isLoading: isPatternsLoading } = useBotPatterns()
  const { data: botConfig, isLoading: isConfigLoading } = useBotConfig()
  const { data: ipRanges, isLoading: isIPRangesLoading } = useBotIPRanges()
  const { data: topBlockedBotsData } = useTopBlockedBots()
  const createPattern = useCreateBotPattern()
  const updatePattern = useUpdateBotPattern()
  const deletePattern = useDeleteBotPattern()
  const bulkDeletePatterns = useBulkDeleteBotPatterns()
  const updateBotConfig = useUpdateBotConfig()
  const createIPRange = useCreateBotIPRange()
  const updateIPRange = useUpdateBotIPRange()
  const deleteIPRange = useDeleteBotIPRange()
  const syncIPRange = useSyncBotIPRange()
  const { addToast } = useToast()

  // Pagination & Search State
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedPatternIds, setSelectedPatternIds] = useState<Set<number>>(new Set())
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // Top Blocked Bots Pagination
  const [blockedBotsPage, setBlockedBotsPage] = useState(1)
  const blockedBotsPerPage = 10

  const topBlockedBots = topBlockedBotsData || []

  // Paginated top blocked bots
  const totalBlockedBotsPages = Math.ceil(topBlockedBots.length / blockedBotsPerPage)
  const paginatedBlockedBots = useMemo(() => {
    const start = (blockedBotsPage - 1) * blockedBotsPerPage
    return topBlockedBots.slice(start, start + blockedBotsPerPage)
  }, [topBlockedBots, blockedBotsPage])

  // Dialog States
  const [isPatternDialogOpen, setIsPatternDialogOpen] = useState(false)
  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false)
  const [isIPRangeDialogOpen, setIsIPRangeDialogOpen] = useState(false)

  const [editingPattern, setEditingPattern] = useState<BotPattern | null>(null)
  const [patternFormData, setPatternFormData] = useState<BotPatternRequest>({
    pattern_type: 'bad_bot',
    pattern: '',
    score: 10,
    verify_ip: false,
    enabled: true,
    description: ''
  })

  const [editingIPRange, setEditingIPRange] = useState<BotIPRange | null>(null)
  const [ipRangeFormData, setIPRangeFormData] = useState<BotIPRangeRequest>({
    name: '',
    source_type: 'json_url',
    url: '',
    ip_ranges: [],
    enabled: true,
    description: ''
  })
  const [manualIPInput, setManualIPInput] = useState('')

  const [configFormData, setConfigFormData] = useState<BotConfig | null>(null)
  const [isRulesExpanded, setIsRulesExpanded] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string | null>('good_bot')

  // Filtered and Paginated Patterns
  const filteredPatterns = useMemo(() => {
    if (!patterns) return []
    return patterns.filter(p => {
      const matchesSearch = p.pattern.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
      const matchesType = !typeFilter || p.pattern_type === typeFilter
      return matchesSearch && matchesType
    })
  }, [patterns, searchTerm, typeFilter])

  const totalPages = Math.ceil(filteredPatterns.length / itemsPerPage)
  const paginatedPatterns = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredPatterns.slice(start, start + itemsPerPage)
  }, [filteredPatterns, currentPage])

  // Classification counts
  const counts = useMemo(() => {
    if (!patterns) return { good: 0, bad: 0, ref: 0, susp: 0 }
    return patterns.reduce((acc, p) => {
      if (p.pattern_type === 'good_bot') acc.good++
      else if (p.pattern_type === 'bad_bot') acc.bad++
      else if (p.pattern_type === 'bad_referer') acc.ref++
      else if (p.pattern_type === 'suspicious_ua') acc.susp++
      return acc
    }, { good: 0, bad: 0, ref: 0, susp: 0 })
  }, [patterns])

  // Handlers
  const handleOpenPatternDialog = (pattern?: BotPattern) => {
    if (pattern) {
      setEditingPattern(pattern)
      setPatternFormData({
        pattern_type: pattern.pattern_type,
        pattern: pattern.pattern,
        score: pattern.score,
        verify_ip: pattern.verify_ip,
        enabled: pattern.enabled,
        description: pattern.description || ''
      })
    } else {
      setEditingPattern(null)
      setPatternFormData({
        pattern_type: 'bad_bot',
        pattern: '',
        score: 10,
        verify_ip: false,
        enabled: true,
        description: ''
      })
    }
    setIsPatternDialogOpen(true)
  }

  const handleOpenRulesDialog = () => {
    if (botConfig) {
      setConfigFormData({ ...botConfig })
      setIsRulesDialogOpen(true)
    }
  }

  const handleSavePattern = async () => {
    try {
      if (editingPattern) {
        await updatePattern.mutateAsync({ id: editingPattern.id, data: patternFormData })
        addToast('Pattern updated successfully', 'success')
      } else {
        await createPattern.mutateAsync(patternFormData)
        addToast('Pattern created successfully', 'success')
      }
      setIsPatternDialogOpen(false)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to save pattern'
      addToast(errorMessage, 'error')
    }
  }

  const handleSaveConfig = async () => {
    if (!configFormData) return
    try {
      await updateBotConfig.mutateAsync(configFormData)
      addToast('Detection settings updated', 'success')
      setIsRulesDialogOpen(false)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update settings'
      addToast(errorMessage, 'error')
    }
  }

  const handleDeletePattern = async (id: number) => {
    if (confirm('Are you sure you want to delete this pattern?')) {
      try {
        await deletePattern.mutateAsync(id)
        addToast('Pattern deleted successfully', 'success')
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to delete pattern'
        addToast(errorMessage, 'error')
      }
    }
  }

  const handleBulkDeletePatterns = async () => {
    const ids = Array.from(selectedPatternIds)
    if (ids.length === 0) return
    try {
      const result = await bulkDeletePatterns.mutateAsync(ids)
      addToast(result.message, 'success')
      setSelectedPatternIds(new Set())
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to bulk delete patterns'
      addToast(errorMessage, 'error')
    }
  }

  const toggleSelectAllPatterns = () => {
    const pageIds = paginatedPatterns.map(p => p.id)
    const allSelected = pageIds.every(id => selectedPatternIds.has(id))
    const next = new Set(selectedPatternIds)
    if (allSelected) {
      pageIds.forEach(id => next.delete(id))
    } else {
      pageIds.forEach(id => next.add(id))
    }
    setSelectedPatternIds(next)
  }

  const toggleSelectPattern = (id: number) => {
    const next = new Set(selectedPatternIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedPatternIds(next)
  }

  // IP Range Handlers
  const handleOpenIPRangeDialog = (item?: BotIPRange) => {
    if (item) {
      setEditingIPRange(item)
      setIPRangeFormData({
        name: item.name,
        source_type: item.source_type,
        url: item.url,
        ip_ranges: item.ip_ranges,
        enabled: item.enabled,
        description: item.description
      })
      setManualIPInput(item.source_type === 'manual' ? item.ip_ranges.join('\n') : '')
    } else {
      setEditingIPRange(null)
      setIPRangeFormData({
        name: '',
        source_type: 'json_url',
        url: '',
        ip_ranges: [],
        enabled: true,
        description: ''
      })
      setManualIPInput('')
    }
    setIsIPRangeDialogOpen(true)
  }

  const handleSaveIPRange = async () => {
    const data = { ...ipRangeFormData }
    if (data.source_type === 'manual') {
      data.ip_ranges = manualIPInput
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
      data.url = ''
    } else {
      data.ip_ranges = []
    }

    try {
      if (editingIPRange) {
        await updateIPRange.mutateAsync({ id: editingIPRange.id, data })
        addToast('IP range provider updated', 'success')
      } else {
        await createIPRange.mutateAsync(data)
        addToast('IP range provider created', 'success')
      }
      setIsIPRangeDialogOpen(false)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to save IP range provider'
      addToast(errorMessage, 'error')
    }
  }

  const handleDeleteIPRange = async (id: number) => {
    if (confirm('Are you sure you want to delete this IP range provider?')) {
      try {
        await deleteIPRange.mutateAsync(id)
        addToast('IP range provider deleted', 'success')
      } catch (error: any) {
        const errorMessage = error?.message || 'Failed to delete IP range provider'
        addToast(errorMessage, 'error')
      }
    }
  }

  const handleSyncIPRange = async (id: number) => {
    try {
      await syncIPRange.mutateAsync(id)
      addToast('IP ranges synced successfully', 'success')
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to sync IP ranges'
      addToast(errorMessage, 'error')
    }
  }

  if (isPatternsLoading || isConfigLoading || isIPRangesLoading) {
    return (
      <div className="space-y-6 animate-in">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse"></div>
          <div className="h-4 w-64 bg-muted/50 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-border rounded-lg p-4">
              <div className="h-4 w-24 bg-muted rounded animate-pulse mb-2"></div>
              <div className="h-8 w-16 bg-muted/50 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="border border-border rounded-lg p-6 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 w-full bg-muted/50 rounded animate-pulse"></div>
            ))}
          </div>
          <div className="lg:col-span-2 border border-border rounded-lg p-6">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 w-full bg-muted/50 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Bot Detector</h1>
          <p className="text-sm text-muted-foreground mt-1">Detect and mitigate automated traffic using heuristic analysis</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Patterns</p>
                <div className="text-xl font-bold mt-1">{patterns?.length || 0}</div>
              </div>
              <div className="p-2 rounded-md icon-container-primary">
                <Shield className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Rules</p>
                <div className="text-xl font-bold mt-1">
                  {patterns?.filter(p => p.enabled).length || 0}
                </div>
              </div>
              <div className="p-2 rounded-md icon-container-success">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Header Detection Scores */}
        <Card className="shadow-none border-border">
          <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 icon-neutral" />
              <CardTitle className="text-sm font-semibold">Header Detection Scores</CardTitle>
            </div>
            <Button size="sm" className="h-8 text-xs px-3 btn-primary text-white hover:opacity-90 shadow-none" onClick={handleOpenRulesDialog}>
              <SquarePen className="w-3 h-3 mr-1.5" />
              Adjust
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {/* Default visible: 6 most important rules */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Missing User-Agent</span>
                  <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.missing_user_agent}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Short User-Agent</span>
                  <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.short_user_agent}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Missing Accept</span>
                  <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.missing_accept}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Generic Accept (*/*)</span>
                  <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.generic_accept}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Missing Accept-Language</span>
                  <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.missing_accept_language}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                  <span className="text-xs font-medium text-foreground">Headless Browser</span>
                  <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.headless_browser || 0}</Badge>
                </div>

                {/* Expanded: remaining rules */}
                {isRulesExpanded && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Missing Sec-Fetch</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.missing_sec_fetch}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Missing Accept-Encoding</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.missing_accept_encoding}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Incomplete Sec-Fetch</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.incomplete_sec_fetch}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">No Browser Indicators</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.no_browser_indicators}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Chromium Missing Sec-CH-UA</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.chromium_missing_sec_ch_ua}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Chromium Missing Sec-Fetch</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.chromium_missing_sec_fetch}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Firefox Has Sec-CH-UA</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.firefox_has_sec_ch_ua}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Wildcard Accept + Browser UA</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.wildcard_accept_browser_ua}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">No Gzip or Brotli</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.no_gzip_or_br}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Geo-Lang Mismatch</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.geo_lang_mismatch}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Repeat No Cookie</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.repeat_no_cookie}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Burst Rate</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.burst_rate}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Regular Interval</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.regular_interval}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/50">
                      <span className="text-xs font-medium text-foreground">Unknown Browser/Bot</span>
                      <Badge className="bg-foreground text-background font-mono text-xs">+{botConfig?.rules.unknown_browser_bot}</Badge>
                    </div>
                  </>
                )}
              </div>

              {/* Toggle Button */}
              <div className="pt-2 border-t border-border/50">
                <button
                  onClick={() => setIsRulesExpanded(!isRulesExpanded)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2 flex items-center justify-center gap-1.5"
                >
                  {isRulesExpanded ? (
                    <>
                      <span>Show less</span>
                      <ChevronLeft className="w-3 h-3 rotate-90" />
                    </>
                  ) : (
                    <>
                      <span>Click to show all ({Object.keys(botConfig?.rules || {}).length} rules)</span>
                      <ChevronRight className="w-3 h-3 rotate-90" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Verified Bot IP Ranges */}
        <Card className="lg:col-span-3 shadow-none border-border overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between py-4 border-b border-border/50 bg-muted/30">
            <div className="flex items-center gap-2">
              <Network className="w-4 h-4 icon-neutral" />
              <CardTitle className="text-sm font-semibold">Verified Bot IP Ranges</CardTitle>
              <Badge className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0 font-bold">{ipRanges?.length || 0}</Badge>
            </div>
            <Button size="sm" className="h-8 text-xs px-3 btn-primary text-white hover:opacity-90 shadow-none" onClick={() => handleOpenIPRangeDialog()}>
              <Plus className="w-3 h-3 mr-1.5" />
              Add Provider
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {ipRanges && ipRanges.length > 0 ? (
              <div className="divide-y divide-border/30">
                {ipRanges.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-foreground">{item.name}</span>
                          <Badge className={`text-[9px] px-1.5 py-0 ${item.source_type === 'json_url' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {item.source_type === 'json_url' ? 'JSON URL' : 'Manual'}
                          </Badge>
                          {item.enabled ? (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full status-active" />
                              <span className="text-[9px] text-muted-foreground">Active</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                              <span className="text-[9px] text-muted-foreground">Disabled</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {item.source_type === 'json_url' && item.url && (
                            <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[400px]" title={item.url}>{item.url}</p>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {item.ip_ranges.length} range{item.ip_ranges.length !== 1 ? 's' : ''}
                          </span>
                          {item.last_fetched && (
                            <span className="text-[10px] text-muted-foreground">
                              Synced: {new Date(item.last_fetched).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {item.source_type === 'json_url' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-muted"
                            onClick={() => handleSyncIPRange(item.id)}
                            disabled={syncIPRange.isPending}
                          >
                            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${syncIPRange.isPending ? 'animate-spin' : ''}`} />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleOpenIPRangeDialog(item)}>
                          <SquarePen className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/50 group" onClick={() => handleDeleteIPRange(item.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <Network className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No IP range providers configured</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Add providers like Googlebot, Bingbot, or Yandex to verify bot IPs</p>
              </div>
            )}
          </CardContent>
        </Card>
        {/* Custom Detection Patterns Table */}
        <Card className="lg:col-span-2 shadow-none border-border overflow-hidden">
          <CardHeader className="py-5 border-b border-border/50">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-sm font-bold">Custom Detection Patterns</CardTitle>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <button
                      onClick={() => {
                        setTypeFilter(typeFilter === 'good_bot' ? null : 'good_bot')
                        setCurrentPage(1)
                      }}
                      className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${typeFilter === 'good_bot' ? 'btn-primary hover:opacity-90 shadow-none' : 'hover:bg-muted/50'
                        }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${typeFilter === 'good_bot' ? 'bg-white' : 'bg-muted-foreground/50'}`} />
                      <span className={`text-[10px] font-medium ${typeFilter === 'good_bot' ? 'text-white' : 'text-muted-foreground'}`}>
                        {counts.good} <span className={typeFilter === 'good_bot' ? 'text-white/80' : 'text-muted-foreground'}>Good</span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setTypeFilter(typeFilter === 'bad_bot' ? null : 'bad_bot')
                        setCurrentPage(1)
                      }}
                      className={`flex items-center gap-1.5 border-l border-border/50 pl-3 px-2 py-1 rounded transition-colors ${typeFilter === 'bad_bot' ? 'btn-primary hover:opacity-90 shadow-none' : 'hover:bg-muted/50'
                        }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${typeFilter === 'bad_bot' ? 'bg-white' : 'bg-muted-foreground/50'}`} />
                      <span className={`text-[10px] font-medium ${typeFilter === 'bad_bot' ? 'text-white' : 'text-muted-foreground'}`}>
                        {counts.bad} <span className={typeFilter === 'bad_bot' ? 'text-white/80' : 'text-muted-foreground'}>Bad</span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setTypeFilter(typeFilter === 'bad_referer' ? null : 'bad_referer')
                        setCurrentPage(1)
                      }}
                      className={`flex items-center gap-1.5 border-l border-border/50 pl-3 px-2 py-1 rounded transition-colors ${typeFilter === 'bad_referer' ? 'btn-primary hover:opacity-90 shadow-none' : 'hover:bg-muted/50'
                        }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${typeFilter === 'bad_referer' ? 'bg-white' : 'bg-muted-foreground/50'}`} />
                      <span className={`text-[10px] font-medium ${typeFilter === 'bad_referer' ? 'text-white' : 'text-muted-foreground'}`}>
                        {counts.ref} <span className={typeFilter === 'bad_referer' ? 'text-white/80' : 'text-muted-foreground'}>Ref</span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setTypeFilter(typeFilter === 'suspicious_ua' ? null : 'suspicious_ua')
                        setCurrentPage(1)
                      }}
                      className={`flex items-center gap-1.5 border-l border-border/50 pl-3 px-2 py-1 rounded transition-colors ${typeFilter === 'suspicious_ua' ? 'btn-primary hover:opacity-90 shadow-none' : 'hover:bg-muted/50'
                        }`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${typeFilter === 'suspicious_ua' ? 'bg-white' : 'bg-muted-foreground/50'}`} />
                      <span className={`text-[10px] font-medium ${typeFilter === 'suspicious_ua' ? 'text-white' : 'text-muted-foreground'}`}>
                        {counts.susp} <span className={typeFilter === 'suspicious_ua' ? 'text-white/80' : 'text-muted-foreground'}>Susp</span>
                      </span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-initial sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search by pattern or description..."
                      className="pl-9 h-9 text-xs bg-muted/50 border-input focus:bg-background transition-colors"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value)
                        setCurrentPage(1)
                      }}
                    />
                  </div>
                  {selectedPatternIds.size > 0 && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-9 px-3 text-xs"
                      onClick={handleBulkDeletePatterns}
                      disabled={bulkDeletePatterns.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:mr-1.5" />
                      <span className="hidden sm:inline">Delete ({selectedPatternIds.size})</span>
                    </Button>
                  )}
                  <Button size="sm" className="btn-primary hover:opacity-90 shadow-none h-9 px-3 text-xs flex-shrink-0" onClick={() => handleOpenPatternDialog()}>
                    <Plus className="w-3.5 h-3.5 sm:mr-1.5" />
                    <span className="hidden sm:inline">Add</span>
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="text-xs font-bold text-muted-foreground py-4 px-4 w-[40px]">
                      <input
                        type="checkbox"
                        className="rounded border-border"
                        checked={paginatedPatterns.length > 0 && paginatedPatterns.every(p => selectedPatternIds.has(p.id))}
                        onChange={toggleSelectAllPatterns}
                      />
                    </TableHead>
                    <TableHead className="w-[350px] text-xs font-bold text-muted-foreground py-4 px-6">Pattern UA</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6">Type</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6">Score</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6">Verify IP</TableHead>
                    <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6">Status</TableHead>
                    <TableHead className="text-right text-xs font-bold text-muted-foreground py-4 px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPatterns.length > 0 ? (
                    paginatedPatterns.map((item) => (
                      <TableRow key={item.id} className="border-border/30 hover:bg-muted/30 transition-colors">
                        <TableCell className="py-4 px-4">
                          <input
                            type="checkbox"
                            className="rounded border-border"
                            checked={selectedPatternIds.has(item.id)}
                            onChange={() => toggleSelectPattern(item.id)}
                          />
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <Shield className={`w-3.5 h-3.5 ${item.pattern_type === 'bad_bot' || item.pattern_type === 'bad_referer' ? 'icon-danger' : item.pattern_type === 'good_bot' ? 'icon-success' : 'icon-warning'}`} />
                              <span className="font-mono text-xs font-medium text-foreground truncate max-w-[300px]" title={item.pattern}>{item.pattern}</span>
                            </div>
                            {item.description && (
                              <span className="text-[10px] text-muted-foreground ml-5 truncate max-w-[300px]">{item.description}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className={`font-bold text-[11px] ${item.pattern_type === 'bad_bot' || item.pattern_type === 'bad_referer' ? 'text-muted-foreground' :
                            item.pattern_type === 'good_bot' ? 'text-muted-foreground' :
                              'text-muted-foreground'
                            }`}>
                            {item.pattern_type.replace('_', ' ')}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className={`text-[11px] font-bold ${item.score >= 10 ? 'text-muted-foreground' : item.score >= 5 ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                            {item.score > 0 ? `+${item.score}` : item.score}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {item.verify_ip ? (
                            <Badge className="action-log hover:action-log text-[9px] h-4 py-0">DNS VERIFY</Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">None</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          {item.enabled ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full status-active" />
                              <span className="text-[10px] font-medium text-muted-foreground">Active</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                              <span className="text-[10px] font-medium text-muted-foreground">Disabled</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-4 px-6 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={() => handleOpenPatternDialog(item)}>
                              <SquarePen className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/50 group" onClick={() => handleDeletePattern(item.id)}>
                              <Trash2 className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground transition-colors" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs">
                        No patterns found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-6 border-t border-border/50 bg-muted/20">
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-muted-foreground font-medium">
                  Showing <span className="text-foreground">{Math.min(filteredPatterns.length, (currentPage - 1) * itemsPerPage + 1)}</span> to <span className="text-foreground">{Math.min(filteredPatterns.length, currentPage * itemsPerPage)}</span> of <span className="text-foreground font-bold">{filteredPatterns.length}</span> patterns
                </p>
                {selectedPatternIds.size > 0 && selectedPatternIds.size < filteredPatterns.length && (
                  <button
                    className="text-[11px] text-primary hover:underline"
                    onClick={() => setSelectedPatternIds(new Set(filteredPatterns.map(p => p.id)))}
                  >
                    Select all {filteredPatterns.length}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Rows</span>
                  <select
                    className="h-7 text-xs bg-background border border-border rounded-md px-1.5 text-foreground"
                    value={itemsPerPage}
                    onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1) }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[11px] px-3 border-border"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1 px-3 h-8 bg-background border border-border rounded-md">
                      <span className="text-xs font-bold text-foreground">{currentPage}</span>
                      <span className="text-xs text-muted-foreground/50">/</span>
                      <span className="text-xs font-medium text-muted-foreground">{totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-[11px] px-3 border-border"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                    >
                      Next
                      <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Blocked Bots Table */}
        <Card className="lg:col-span-1 shadow-none border-border overflow-hidden">
          <CardHeader className="py-5 border-b border-border/50 bg-muted/30">
            <CardTitle className="text-sm font-bold">Top Blocked Bots</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-1">Most blocked user agents (last 100 blocks)</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {paginatedBlockedBots.length > 0 ? (
                paginatedBlockedBots.map((bot, i) => {
                  const globalIndex = (blockedBotsPage - 1) * blockedBotsPerPage + i
                  return (
                    <div key={i} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="bg-muted text-foreground text-[9px] px-1.5 py-0 font-bold">#{globalIndex + 1}</Badge>
                            <span className="text-xs font-bold text-foreground">{bot.count} visitor</span>
                          </div>
                          <p className="text-[10px] font-mono text-muted-foreground truncate" title={bot.ua}>
                            {bot.ua}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No blocked bots yet
                </div>
              )}
            </div>

            {/* Pagination for Top Blocked Bots */}
            {totalBlockedBotsPages > 1 && (
              <div className="flex items-center justify-between p-4 border-t border-border/50 bg-muted/20">
                <p className="text-[11px] text-muted-foreground font-medium">
                  Page <span className="text-foreground font-bold">{blockedBotsPage}</span> of <span className="text-foreground">{totalBlockedBotsPages}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 border-border"
                    disabled={blockedBotsPage === 1}
                    onClick={() => setBlockedBotsPage(prev => prev - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0 border-border"
                    disabled={blockedBotsPage === totalBlockedBotsPages}
                    onClick={() => setBlockedBotsPage(prev => prev + 1)}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pattern Dialog */}
      <Dialog open={isPatternDialogOpen} onOpenChange={setIsPatternDialogOpen}>
        <DialogContent
          className="max-w-2xl p-0 overflow-hidden border-none shadow-none"
        >
          <DialogHeader className="px-8 py-5 bg-muted/50 border-b border-border">
            <DialogTitle className="text-lg font-bold text-foreground">{editingPattern ? 'Edit Detection Pattern' : 'Create Detection Pattern'}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Define a User-Agent or Referer substring and its associated threat level.</DialogDescription>
          </DialogHeader>

          <div className="px-8 py-8 space-y-6 bg-card">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2.5">
                <Label htmlFor="type" className="text-xs font-bold text-foreground uppercase tracking-wider">Classification</Label>
                <select
                  value={patternFormData.pattern_type}
                  onChange={(e) => {
                    const newType = e.target.value as any
                    let suggestedScore = patternFormData.score
                    if (newType === 'good_bot' && patternFormData.score >= 0) {
                      suggestedScore = -100
                    } else if (newType !== 'good_bot' && patternFormData.score < 0) {
                      suggestedScore = 10
                    }
                    setPatternFormData({ ...patternFormData, pattern_type: newType, score: suggestedScore })
                  }}
                  className="flex h-10 w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                >
                  <option value="good_bot">Good Bot (Whitelisted)</option>
                  <option value="bad_bot">Bad Bot (Block/Challenge)</option>
                  <option value="bad_referer">Bad Referrer (Block/Challenge)</option>
                  <option value="suspicious_ua">Suspicious (Higher Scrutiny)</option>
                </select>
              </div>
              <div className="space-y-2.5">
                <Label htmlFor="score" className="text-xs font-bold text-foreground uppercase tracking-wider">Assigned Score</Label>
                <div className="relative">
                  <Input
                    id="score"
                    type="number"
                    value={patternFormData.score}
                    onChange={(e) => setPatternFormData({ ...patternFormData, score: parseInt(e.target.value) || 0 })}
                    className="h-10 bg-background border-input pl-4"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">PTS</div>
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  {patternFormData.pattern_type === 'good_bot'
                    ? 'Use negative score (e.g., -100) to whitelist and bypass all checks.'
                    : 'Range: 0-50 points. Higher scores trigger stricter actions.'}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="pattern" className="text-xs font-bold text-foreground uppercase tracking-wider">Pattern Substring</Label>
              <Input
                id="pattern"
                value={patternFormData.pattern}
                onChange={(e) => setPatternFormData({ ...patternFormData, pattern: e.target.value })}
                placeholder="e.g. Googlebot, curl/, python-requests"
                className="h-10 font-mono text-sm bg-background border-input"
              />
              <p className="text-[10px] text-muted-foreground italic">Matching is case-insensitive. Provide the unique part of the UA string or Referer domain.</p>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="desc" className="text-xs font-bold text-foreground uppercase tracking-wider">Internal Description</Label>
              <Input
                id="desc"
                value={patternFormData.description}
                onChange={(e) => setPatternFormData({ ...patternFormData, description: e.target.value })}
                placeholder="What is this bot for?"
                className="h-10 bg-background border-input"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
              <div className="space-y-1">
                <Label className="text-sm font-bold text-foreground">Verify Identity via DNS</Label>
                <p className="text-[11px] text-muted-foreground/70">Confirm bot origin (recommended for search engines).</p>
              </div>
              <Switch
                checked={patternFormData.verify_ip}
                onCheckedChange={(v) => setPatternFormData({ ...patternFormData, verify_ip: v })}
                className="data-[state=checked]:btn-primary"
              />
            </div>
          </div>

          <DialogFooter className="px-8 py-5 bg-muted/50 border-t border-border">
            <Button variant="ghost" onClick={() => setIsPatternDialogOpen(false)} className="text-muted-foreground">Cancel</Button>
            <Button
              onClick={handleSavePattern}
              disabled={!patternFormData.pattern}
              className="px-8 btn-primary hover:opacity-90 transition-all active:scale-95 shadow-none"
            >
              {editingPattern ? (
                <Save className="w-4 h-4 mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {editingPattern ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rules Scores Dialog */}
      <Dialog open={isRulesDialogOpen} onOpenChange={setIsRulesDialogOpen}>
        <DialogContent
          className="max-w-2xl p-0 overflow-hidden border-none shadow-none"
        >
          <DialogHeader className="px-8 py-5 bg-muted/50 border-b border-border">
            <DialogTitle className="text-lg font-bold text-foreground">Heuristic Rule Weights</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Assign point weights to built-in browser-consistency checks.</DialogDescription>
          </DialogHeader>

          {configFormData && (
            <div className="px-8 py-8 bg-card max-h-[60vh] overflow-y-auto">
              <div className="space-y-6">
                {/* Basic Headers */}
                <div>
                  <h3 className="text-xs font-bold text-foreground mb-4 pb-2 border-b border-border">Basic Headers</h3>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Missing User-Agent</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.missing_user_agent}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, missing_user_agent: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Short User-Agent</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.short_user_agent}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, short_user_agent: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Missing Accept</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.missing_accept}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, missing_accept: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Generic Accept (*/*)</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.generic_accept}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, generic_accept: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Completeness Checks */}
                <div>
                  <h3 className="text-xs font-bold text-foreground mb-4 pb-2 border-b border-border">Completeness Checks</h3>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Missing Accept-Language</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.missing_accept_language}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, missing_accept_language: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Missing Accept-Encoding</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.missing_accept_encoding}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, missing_accept_encoding: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Missing Sec-Fetch</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.missing_sec_fetch}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, missing_sec_fetch: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Incomplete Sec-Fetch</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.incomplete_sec_fetch}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, incomplete_sec_fetch: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Browser Indicators</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.no_browser_indicators}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, no_browser_indicators: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Browser Consistency */}
                <div>
                  <h3 className="text-xs font-bold text-foreground mb-4 pb-2 border-b border-border">Browser Consistency</h3>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chromium Missing Sec-CH-UA</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.chromium_missing_sec_ch_ua}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, chromium_missing_sec_ch_ua: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Chromium Missing Sec-Fetch</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.chromium_missing_sec_fetch}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, chromium_missing_sec_fetch: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Firefox Has Sec-CH-UA</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.firefox_has_sec_ch_ua}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, firefox_has_sec_ch_ua: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Wildcard Accept + Browser UA</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.wildcard_accept_browser_ua}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, wildcard_accept_browser_ua: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Gzip or Brotli</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.no_gzip_or_br}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, no_gzip_or_br: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Headless Browser</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.headless_browser || 0}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, headless_browser: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                  </div>
                </div>

                {/* Behavioral Analysis */}
                <div>
                  <h3 className="text-xs font-bold text-foreground mb-4 pb-2 border-b border-border">Behavioral Analysis</h3>
                  <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Geo-Lang Mismatch</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.geo_lang_mismatch}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, geo_lang_mismatch: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Repeat No Cookie</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.repeat_no_cookie}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, repeat_no_cookie: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Burst Rate</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.burst_rate}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, burst_rate: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Regular Interval</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.regular_interval}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, regular_interval: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unknown Browser/Bot</Label>
                      <Input
                        type="number"
                        value={configFormData.rules.unknown_browser_bot}
                        onChange={(e) => setConfigFormData({ ...configFormData, rules: { ...configFormData.rules, unknown_browser_bot: parseInt(e.target.value) || 0 } })}
                        className="h-10 border-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="px-8 py-5 bg-muted/50 border-t border-border">
            <Button variant="ghost" onClick={() => setIsRulesDialogOpen(false)} className="text-muted-foreground">Cancel</Button>
            <Button onClick={handleSaveConfig} className="btn-primary hover:opacity-90 transition-all active:scale-95 shadow-none">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IP Range Dialog */}
      <Dialog open={isIPRangeDialogOpen} onOpenChange={setIsIPRangeDialogOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-none">
          <DialogHeader className="px-8 py-5 bg-muted/50 border-b border-border">
            <DialogTitle className="text-lg font-bold text-foreground">{editingIPRange ? 'Edit IP Range Provider' : 'Add IP Range Provider'}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Configure a verified bot IP range source (JSON URL or manual CIDR entries).</DialogDescription>
          </DialogHeader>

          <div className="px-8 py-8 space-y-6 bg-card max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2.5">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Provider Name</Label>
                <Input
                  value={ipRangeFormData.name}
                  onChange={(e) => setIPRangeFormData({ ...ipRangeFormData, name: e.target.value })}
                  placeholder="e.g. Googlebot, Bingbot, Yandex"
                  className="h-10 bg-background border-input"
                />
              </div>
              <div className="space-y-2.5">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Source Type</Label>
                <select
                  value={ipRangeFormData.source_type}
                  onChange={(e) => setIPRangeFormData({ ...ipRangeFormData, source_type: e.target.value as 'json_url' | 'manual' })}
                  className="flex h-10 w-full rounded border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                >
                  <option value="json_url">JSON URL (auto-fetch)</option>
                  <option value="manual">Manual (CIDR entries)</option>
                </select>
              </div>
            </div>

            {ipRangeFormData.source_type === 'json_url' && (
              <div className="space-y-2.5">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wider">JSON URL</Label>
                <Input
                  value={ipRangeFormData.url}
                  onChange={(e) => setIPRangeFormData({ ...ipRangeFormData, url: e.target.value })}
                  placeholder="https://www.bing.com/toolbox/bingbot.json"
                  className="h-10 font-mono text-sm bg-background border-input"
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Supports Google/Bing JSON format (prefixes[].ipv4Prefix) and plain text (one CIDR per line).
                </p>
              </div>
            )}

            {ipRangeFormData.source_type === 'manual' && (
              <div className="space-y-2.5">
                <Label className="text-xs font-bold text-foreground uppercase tracking-wider">IP Ranges (one per line)</Label>
                <textarea
                  value={manualIPInput}
                  onChange={(e) => setManualIPInput(e.target.value)}
                  placeholder={"5.45.192.0/18\n5.255.192.0/18\n37.9.64.0/18\n192.168.1.1"}
                  rows={8}
                  className="flex w-full rounded border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring transition-all resize-y"
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Enter CIDR ranges (e.g. 5.45.192.0/18) or single IPs (e.g. 192.168.1.1), one per line.
                </p>
              </div>
            )}

            <div className="space-y-2.5">
              <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Description</Label>
              <Input
                value={ipRangeFormData.description}
                onChange={(e) => setIPRangeFormData({ ...ipRangeFormData, description: e.target.value })}
                placeholder="Official IP ranges for this bot provider"
                className="h-10 bg-background border-input"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
              <div className="space-y-1">
                <Label className="text-sm font-bold text-foreground">Enabled</Label>
                <p className="text-[11px] text-muted-foreground/70">Use these ranges for bot IP verification.</p>
              </div>
              <Switch
                checked={ipRangeFormData.enabled}
                onCheckedChange={(v) => setIPRangeFormData({ ...ipRangeFormData, enabled: v })}
                className="data-[state=checked]:btn-primary"
              />
            </div>
          </div>

          <DialogFooter className="px-8 py-5 bg-muted/50 border-t border-border">
            <Button variant="ghost" onClick={() => setIsIPRangeDialogOpen(false)} className="text-muted-foreground">Cancel</Button>
            <Button
              onClick={handleSaveIPRange}
              disabled={!ipRangeFormData.name || (ipRangeFormData.source_type === 'json_url' && !ipRangeFormData.url) || (ipRangeFormData.source_type === 'manual' && !manualIPInput.trim())}
              className="px-8 btn-primary hover:opacity-90 transition-all active:scale-95 shadow-none"
            >
              {editingIPRange ? (
                <Save className="w-4 h-4 mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {editingIPRange ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

