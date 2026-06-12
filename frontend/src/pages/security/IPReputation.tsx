import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, SquarePen, Trash2, Search, ChevronLeft, ChevronRight, Save, Globe, Network, RefreshCw, ShieldAlert } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  useIPReputationEntries,
  useCreateIPReputationEntry,
  useUpdateIPReputationEntry,
  useDeleteIPReputationEntry,
  useBulkDeleteIPReputationEntries,
  useBulkUpdateScoreIPReputationEntries,
  useIPReputationConfig,
  useUpdateIPReputationConfig,
  useSyncSpamhaus,
} from '@/hooks/useApi'
import type { IPReputationEntry, IPReputationEntryRequest, IPReputationConfig } from '@/lib/api-client'

export default function IPReputation() {
  const { data: entries, isLoading } = useIPReputationEntries()
  const { data: repConfig, isLoading: isConfigLoading } = useIPReputationConfig()
  const createEntry = useCreateIPReputationEntry()
  const updateEntry = useUpdateIPReputationEntry()
  const deleteEntry = useDeleteIPReputationEntry()
  const bulkDeleteEntries = useBulkDeleteIPReputationEntries()
  const bulkUpdateScore = useBulkUpdateScoreIPReputationEntries()
  const updateConfig = useUpdateIPReputationConfig()
  const syncSpamhaus = useSyncSpamhaus()
  const { addToast } = useToast()

  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [isBulkScoreOpen, setIsBulkScoreOpen] = useState(false)
  const [bulkScoreValue, setBulkScoreValue] = useState(10)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<IPReputationEntry | null>(null)
  const [formType, setFormType] = useState<'ip' | 'asn'>('ip')
  const [formValues, setFormValues] = useState('')
  const [formScore, setFormScore] = useState(10)
  const [formCategory, setFormCategory] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)
  const [formAutoDetect, setFormAutoDetect] = useState(true)

  const [configForm, setConfigForm] = useState<IPReputationConfig | null>(null)
  const [maxmindDirty, setMaxmindDirty] = useState(false)
  const [spamhausDirty, setSpamhausDirty] = useState(false)

  const filteredEntries = useMemo(() => {
    if (!entries) return []
    return entries.filter(e => {
      const matchesSearch = e.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = !typeFilter || e.entry_type === typeFilter
      const matchesCategory = !categoryFilter || e.category === categoryFilter
      return matchesSearch && matchesType && matchesCategory
    })
  }, [entries, searchTerm, typeFilter, categoryFilter])

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage)
  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredEntries.slice(start, start + itemsPerPage)
  }, [filteredEntries, currentPage])

  const counts = useMemo(() => {
    if (!entries) return { ip: 0, asn: 0 }
    return entries.reduce((acc, e) => {
      if (e.entry_type === 'ip') acc.ip++
      else acc.asn++
      return acc
    }, { ip: 0, asn: 0 })
  }, [entries])

  const categoryCounts = useMemo(() => {
    if (!entries) return {} as Record<string, number>
    return entries.reduce((acc, e) => {
      if (e.category) {
        acc[e.category] = (acc[e.category] || 0) + 1
      }
      return acc
    }, {} as Record<string, number>)
  }, [entries])

  function openCreate() {
    setEditingEntry(null)
    setFormType('ip')
    setFormValues('')
    setFormScore(10)
    setFormCategory('')
    setFormDescription('')
    setFormEnabled(true)
    setFormAutoDetect(true)
    setIsDialogOpen(true)
  }

  function openEdit(entry: IPReputationEntry) {
    setEditingEntry(entry)
    setFormType(entry.entry_type as 'ip' | 'asn')
    setFormValues(entry.value)
    setFormScore(entry.score)
    setFormCategory(entry.category || '')
    setFormDescription(entry.description)
    setFormEnabled(entry.enabled)
    setIsDialogOpen(true)
  }

  async function handleSubmit() {
    if (editingEntry) {
      const data: IPReputationEntryRequest = {
        entry_type: formType,
        value: formValues.trim(),
        score: formScore,
        category: formCategory,
        description: formDescription,
        enabled: formEnabled,
      }
      updateEntry.mutate(
        { id: editingEntry.id, data },
        {
          onSuccess: () => {
            addToast('Entry updated', 'success')
            setIsDialogOpen(false)
          },
          onError: (err: any) => {
            addToast(err?.response?.error || err.message, 'error')
          },
        }
      )
    } else {
      const values = formValues
        .split(/[\n,]+/)
        .map(v => v.trim())
        .filter(v => v.length > 0)

      if (values.length === 0) return

      const data: IPReputationEntryRequest = {
        entry_type: formType,
        values,
        score: formScore,
        category: formCategory,
        description: formDescription,
        enabled: formEnabled,
        auto_detect_provider: formAutoDetect && formDescription === '',
      }

      // Close dialog immediately for large batches — process runs in background
      setIsDialogOpen(false)
      if (values.length > 10) {
        addToast(`Processing ${values.length} entries in background...`, 'info')
      }

      createEntry.mutate(data, {
        onSuccess: () => {
          addToast(`${values.length} entry(s) created`, 'success')
        },
        onError: (err: any) => {
          addToast(err?.response?.error || err.message, 'error')
        },
      })
    }
  }

  function handleDelete(id: number) {
    deleteEntry.mutate(id, {
      onSuccess: () => addToast('Entry deleted', 'success'),
      onError: (err: any) => addToast(err?.response?.error || err.message, 'error'),
    })
  }

  function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    bulkDeleteEntries.mutate(ids, {
      onSuccess: (data) => {
        addToast(data.message, 'success')
        setSelectedIds(new Set())
      },
      onError: (err: any) => addToast(err?.response?.error || err.message, 'error'),
    })
  }

  function handleBulkUpdateScore() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    bulkUpdateScore.mutate({ ids, score: bulkScoreValue }, {
      onSuccess: (data) => {
        addToast(data.message, 'success')
        setSelectedIds(new Set())
        setIsBulkScoreOpen(false)
      },
      onError: (err: any) => addToast(err?.response?.error || err.message, 'error'),
    })
  }

  function toggleSelectAll() {
    const pageIds = paginatedEntries.map(e => e.id)
    const allSelected = pageIds.every(id => selectedIds.has(id))
    const next = new Set(selectedIds)
    if (allSelected) {
      pageIds.forEach(id => next.delete(id))
    } else {
      pageIds.forEach(id => next.add(id))
    }
    setSelectedIds(next)
  }

  function toggleSelect(id: number) {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  function handleSaveMaxmind() {
    if (!configForm) return
    updateConfig.mutate(configForm, {
      onSuccess: () => {
        addToast('MaxMind scoring updated', 'success')
        setMaxmindDirty(false)
      },
      onError: (err: any) => addToast(err?.response?.error || err.message, 'error'),
    })
  }

  function handleSaveSpamhaus() {
    if (!configForm) return
    updateConfig.mutate(configForm, {
      onSuccess: () => {
        addToast('Spamhaus scoring updated', 'success')
        setSpamhausDirty(false)
      },
      onError: (err: any) => addToast(err?.response?.error || err.message, 'error'),
    })
  }

  const currentConfig = configForm ?? repConfig

  if (isLoading || isConfigLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Scoring Config Grid: MaxMind + Spamhaus side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* MaxMind Config Card */}
        <Card className="shadow-none border-border overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Globe className="w-4 h-4" />
              MaxMind Scoring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Auto-detect datacenter and cloud provider IPs. Manual entries override.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Datacenter IP Score</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={currentConfig?.maxmind_dc_score ?? 10}
                  onChange={e => { setConfigForm({ ...currentConfig!, maxmind_dc_score: Number(e.target.value) }); setMaxmindDirty(true) }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cloud Provider ASN Score</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={currentConfig?.maxmind_asn_score ?? 20}
                  onChange={e => { setConfigForm({ ...currentConfig!, maxmind_asn_score: Number(e.target.value) }); setMaxmindDirty(true) }}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveMaxmind}
                disabled={updateConfig.isPending || !maxmindDirty}
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Spamhaus DROP Lists Card */}
        <Card className="shadow-none border-border overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Spamhaus DROP Lists
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  syncSpamhaus.mutate(undefined, {
                    onSuccess: (data) => addToast(data.message, 'success'),
                    onError: (err: any) => addToast(err?.response?.error || err.message, 'error'),
                  })
                }}
                disabled={syncSpamhaus.isPending}
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncSpamhaus.isPending ? 'animate-spin' : ''}`} />
                {syncSpamhaus.isPending ? 'Syncing...' : 'Sync'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Sync bad IPs/ASNs from Spamhaus DROP, DROPv6, and ASN-DROP.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Bad IP/CIDR Score</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={currentConfig?.spamhaus_ip_score ?? 50}
                  onChange={e => { setConfigForm({ ...currentConfig!, spamhaus_ip_score: Number(e.target.value) }); setSpamhausDirty(true) }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bad ASN Score</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={currentConfig?.spamhaus_asn_score ?? 50}
                  onChange={e => { setConfigForm({ ...currentConfig!, spamhaus_asn_score: Number(e.target.value) }); setSpamhausDirty(true) }}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveSpamhaus}
                disabled={updateConfig.isPending || !spamhausDirty}
              >
                <Save className="w-3.5 h-3.5 mr-1.5" />
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Entries Card */}
      <Card className="shadow-none border-border overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Network className="w-4 h-4" />
              Manual Entries
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setBulkScoreValue(10); setIsBulkScoreOpen(true) }}
                  >
                    <SquarePen className="w-3.5 h-3.5 mr-1.5" />
                    Edit Score ({selectedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleteEntries.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Delete ({selectedIds.size})
                  </Button>
                </>
              )}
              <Button size="sm" onClick={openCreate} disabled={createEntry.isPending}>
                {createEntry.isPending ? (
                  <div className="w-3.5 h-3.5 mr-1.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                )}
                {createEntry.isPending ? 'Processing...' : 'Add Entry'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Filters */}
          <div className="flex items-center gap-3 px-6 pb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1) }}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex gap-1.5">
              <Button
                variant={typeFilter === null ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={() => { setTypeFilter(null); setCategoryFilter(null); setCurrentPage(1) }}
              >
                All ({(entries?.length ?? 0)})
              </Button>
              <Button
                variant={typeFilter === 'ip' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={() => { setTypeFilter('ip'); setCurrentPage(1) }}
              >
                IP/CIDR ({counts.ip})
              </Button>
              <Button
                variant={typeFilter === 'asn' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={() => { setTypeFilter('asn'); setCurrentPage(1) }}
              >
                ASN ({counts.asn})
              </Button>
            </div>
            <div className="flex gap-1.5">
              {(['hosting', 'vpn_proxy', 'scanner', 'good', 'bad'] as const).map(cat => {
                const count = categoryCounts[cat] || 0
                return (
                  <Button
                    key={cat}
                    variant={categoryFilter === cat ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-[11px] px-2.5"
                    onClick={() => { setCategoryFilter(categoryFilter === cat ? null : cat); setCurrentPage(1) }}
                  >
                    {cat === 'vpn_proxy' ? 'VPN/Proxy' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    {count > 0 && ` (${count})`}
                  </Button>
                )
              })}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-xs font-bold text-muted-foreground py-4 px-4 w-[40px]">
                    <input
                      type="checkbox"
                      className="rounded border-border"
                      checked={paginatedEntries.length > 0 && paginatedEntries.every(e => selectedIds.has(e.id))}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6 w-[80px]">Type</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6">Value</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6 w-[90px]">Category</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6 w-[70px]">Score</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6">Description</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6 w-[70px]">Status</TableHead>
                  <TableHead className="text-xs font-bold text-muted-foreground py-4 px-6 w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-xs text-muted-foreground h-32">
                      No entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedEntries.map(entry => (
                    <TableRow key={entry.id} className="border-border/30 hover:bg-muted/30 transition-colors">
                      <TableCell className="py-4 px-4">
                        <input
                          type="checkbox"
                          className="rounded border-border"
                          checked={selectedIds.has(entry.id)}
                          onChange={() => toggleSelect(entry.id)}
                        />
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant={entry.entry_type === 'ip' ? 'default' : 'secondary'} className="text-[10px]">
                          {entry.entry_type === 'ip' ? 'IP/CIDR' : 'ASN'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-xs font-mono">{entry.value}</TableCell>
                      <TableCell className="py-4 px-6">
                        {entry.category ? (
                          <Badge variant="outline" className="text-[10px]">
                            {entry.category === 'vpn_proxy' ? 'VPN/Proxy' : entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-6 text-xs font-bold">+{entry.score}</TableCell>
                      <TableCell className="py-4 px-6 text-xs text-muted-foreground truncate max-w-[200px]">
                        {entry.description || '—'}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant={entry.enabled ? 'default' : 'outline'} className="text-[10px]">
                          {entry.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted" onClick={() => openEdit(entry)}>
                            <SquarePen className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:bg-muted" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-border/50">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">
                {filteredEntries.length} entries
              </span>
              {selectedIds.size > 0 && selectedIds.size < filteredEntries.length && (
                <button
                  className="text-[11px] text-primary hover:underline"
                  onClick={() => setSelectedIds(new Set(filteredEntries.map(e => e.id)))}
                >
                  Select all {filteredEntries.length}
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
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <div className="flex items-center gap-1 px-3 h-7 bg-background border border-border rounded-md">
                    <span className="text-xs font-bold text-foreground">{currentPage}</span>
                    <span className="text-xs text-muted-foreground/50">/</span>
                    <span className="text-xs text-muted-foreground">{totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-none">
          <DialogHeader className="px-6 py-4 bg-muted/50 border-b border-border">
            <DialogTitle>{editingEntry ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={formType === 'ip' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormType('ip')}
                >
                  IP / CIDR
                </Button>
                <Button
                  type="button"
                  variant={formType === 'asn' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormType('asn')}
                >
                  ASN
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {formType === 'ip' ? 'IP Address or CIDR' : 'ASN Number'}
                {!editingEntry && <span className="text-muted-foreground ml-1">(one per line)</span>}
              </Label>
              {editingEntry ? (
                <Input
                  placeholder={formType === 'ip' ? '192.168.1.0/24' : '14061'}
                  value={formValues}
                  onChange={e => setFormValues(e.target.value)}
                />
              ) : (
                <Textarea
                  placeholder={formType === 'ip'
                    ? '192.168.1.0/24\n10.0.0.1\n172.16.0.0/12'
                    : '14061\n16509\n15169'}
                  value={formValues}
                  onChange={e => setFormValues(e.target.value)}
                  rows={4}
                  className="font-mono text-xs"
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                {editingEntry
                  ? (formType === 'ip'
                    ? 'Single IP (10.0.0.1) or CIDR range (192.168.0.0/16)'
                    : 'Autonomous System Number, e.g. 14061 (DigitalOcean)')
                  : (formType === 'ip'
                    ? 'Enter multiple IPs/CIDRs separated by new lines or commas'
                    : 'Enter multiple ASN numbers separated by new lines or commas')}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <select
                className="w-full h-9 text-xs bg-background border border-border rounded-md px-3 text-foreground"
                value={formCategory}
                onChange={e => setFormCategory(e.target.value)}
              >
                <option value="">None</option>
                <option value="hosting">Hosting</option>
                <option value="vpn_proxy">VPN/Proxy</option>
                <option value="scanner">Scanner</option>
                <option value="good">Good</option>
                <option value="bad">Bad</option>
              </select>
              <p className="text-[11px] text-muted-foreground">
                Optional label for organization. Does not affect scoring.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Score (1-100)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={formScore}
                onChange={e => setFormScore(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                Score contribution to risk assessment. Higher = more suspicious.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                placeholder={formAutoDetect && !editingEntry ? 'Auto-detected from MaxMind' : 'Optional description'}
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                disabled={formAutoDetect && !editingEntry && formDescription === ''}
              />
            </div>
            {!editingEntry && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={formAutoDetect}
                  onCheckedChange={checked => {
                    setFormAutoDetect(checked)
                    if (checked) setFormDescription('')
                  }}
                />
                <Label className="text-xs">Auto-detect provider (MaxMind)</Label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                checked={formEnabled}
                onCheckedChange={checked => setFormEnabled(checked)}
              />
              <Label className="text-xs">Enabled</Label>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={createEntry.isPending || updateEntry.isPending || !formValues.trim()}
            >
              {editingEntry ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Score Dialog */}
      <Dialog open={isBulkScoreOpen} onOpenChange={setIsBulkScoreOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden border-none shadow-none">
          <DialogHeader className="px-6 py-4 bg-muted/50 border-b border-border">
            <DialogTitle>Edit Score ({selectedIds.size} entries)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <Label className="text-xs">New Score (1-100)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={bulkScoreValue}
                onChange={e => setBulkScoreValue(Number(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                All selected entries will be updated to this score.
              </p>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border">
            <Button variant="outline" onClick={() => setIsBulkScoreOpen(false)}>Cancel</Button>
            <Button
              onClick={handleBulkUpdateScore}
              disabled={bulkUpdateScore.isPending || bulkScoreValue < 1 || bulkScoreValue > 100}
            >
              Update Score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
