import { useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, ArrowRightLeft, Info } from 'lucide-react'
import type { AppCreateRequest, AppConfig, Upstream } from '@/lib/api-client'

function TagInput({ tags, onChange, placeholder, uppercase }: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  uppercase?: boolean
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    const val = uppercase ? raw.trim().toUpperCase() : raw.trim()
    if (val && !tags.includes(val)) onChange([...tags, val])
    setInput('')
  }

  const removeTag = (tag: string) => onChange(tags.filter(t => t !== tag))

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-9 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-mono font-semibold border border-primary/20"
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
            className="text-primary/60 hover:text-primary leading-none"
          >×</button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) addTag(input) }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] bg-transparent text-xs font-mono outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

export { TagInput }

interface BasicTabProps {
  formData: AppCreateRequest
  isEdit: boolean
  setFormData: React.Dispatch<React.SetStateAction<AppCreateRequest>>
  updateConfig: (key: keyof AppConfig, value: any) => void
}

export function BasicTab({ formData, isEdit, setFormData, updateConfig }: BasicTabProps) {
  const [idManuallyEdited, setIdManuallyEdited] = useState(false)

  // Auto-generate app name from domain when user hasn't manually edited it
  const generateIdFromDomain = (domain: string): string => {
    if (!domain) return ''
    return domain
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, '')
      .replace(/\./g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const generateRandomId = (): string => {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    return 'app-' + hex
  }

  const handleDomainChange = (domain: string) => {
    setFormData(prev => {
      const next = { ...prev, domain }
      if (!isEdit && !idManuallyEdited) {
        next.id = generateIdFromDomain(domain) || ''
      }
      return next
    })
  }

  const handleIdChange = (id: string) => {
    setIdManuallyEdited(true)
    setFormData(prev => ({ ...prev, id }))
  }

  const handleGenerateClick = () => {
    const generated = formData.domain
      ? generateIdFromDomain(formData.domain)
      : generateRandomId()
    setFormData(prev => ({ ...prev, id: generated }))
    setIdManuallyEdited(true)
  }
  const addUpstream = () => {
    updateConfig('upstreams', [
      ...formData.config.upstreams,
      { scheme: 'http', host: '', port: 80, weight: 1, enabled: true } as Upstream,
    ])
  }

  const removeUpstream = (index: number) => {
    if (formData.config.upstreams.length <= 1) return
    const next = [...formData.config.upstreams]
    next.splice(index, 1)
    updateConfig('upstreams', next)
  }

  const handleUpstreamChange = (index: number, field: keyof Upstream, value: any) => {
    const next = [...formData.config.upstreams]
    next[index] = { ...next[index], [field]: value }
    updateConfig('upstreams', next)
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Identity */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Application Identity</h2>
        <Card className="shadow-none border-border">
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">App Name *</Label>
                <div className="flex gap-2">
                  <Input
                    disabled={isEdit}
                    value={formData.id}
                    onChange={(e) => handleIdChange(e.target.value)}
                    placeholder="auto generated from domain"
                    className="border-input bg-muted/30 font-mono text-xs disabled:opacity-60 flex-1"
                  />
                  {!isEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateClick}
                      className="h-9 px-2.5 text-[10px] font-bold shrink-0"
                      title="Generate from domain or random"
                    >
                      Gen
                    </Button>
                  )}
                </div>
                {!isEdit && <p className="text-[10px] text-muted-foreground">Auto generated from domain. Click Gen for random.</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Domain *</Label>
                <Input
                  value={formData.domain}
                  onChange={(e) => handleDomainChange(e.target.value)}
                  placeholder="e.g. api.example.com"
                  className="border-input font-semibold text-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Description</Label>
              <Input
                value={formData.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. API gateway"
                className="border-input text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Optional. Helps identify this app in the list.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upstreams */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Origin Upstreams</h2>
          <Button type="button" variant="outline" size="sm" onClick={addUpstream} className="h-7 text-[10px] font-bold btn-primary text-white hover:opacity-90 px-2">
            <Plus className="w-3 h-3 mr-1" /> ADD SERVER
          </Button>
        </div>
        <Card className="shadow-none border-border">
          <CardContent className="p-6 space-y-3">
            {formData.config.upstreams.map((u, index) => (
              <div
                key={index}
                className={`p-3 rounded-xl border transition-all ${
                  u.enabled !== false ? 'bg-muted/30 border-border' : 'bg-muted/10 border-border opacity-50'
                }`}
              >
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3 space-y-1">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase">Scheme</Label>
                    <select
                      className="flex h-8 w-full rounded-lg border border-input bg-background px-2 py-0 text-xs font-semibold text-foreground"
                      value={u.scheme}
                      onChange={(e) => handleUpstreamChange(index, 'scheme', e.target.value)}
                    >
                      <option value="http">HTTP</option>
                      <option value="https">HTTPS</option>
                      <option value="tcp">TCP</option>
                      <option value="udp">UDP</option>
                    </select>
                  </div>
                  <div className="col-span-6 space-y-1">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase">Host / IP</Label>
                    <Input
                      placeholder="127.0.0.1 or example.com"
                      value={u.host}
                      onChange={(e) => handleUpstreamChange(index, 'host', e.target.value)}
                      className="h-8 text-xs border-input"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase">Port</Label>
                    <Input
                      type="number"
                      placeholder="8080"
                      value={u.port}
                      onChange={(e) => handleUpstreamChange(index, 'port', parseInt(e.target.value) || 0)}
                      className="h-8 text-xs border-input"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center pb-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => removeUpstream(index)}
                      disabled={formData.config.upstreams.length <= 1}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase shrink-0">Weight</Label>
                    <div className="flex items-center border border-input rounded-lg overflow-hidden h-7">
                      <button
                        type="button"
                        className="w-6 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm font-bold select-none"
                        onClick={() => handleUpstreamChange(index, 'weight', Math.max(1, (u.weight ?? 1) - 1))}
                      >−</button>
                      <span className="w-7 text-center text-xs font-mono font-bold text-foreground border-x border-input h-full flex items-center justify-center">
                        {u.weight ?? 1}
                      </span>
                      <button
                        type="button"
                        className="w-6 h-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-sm font-bold select-none"
                        onClick={() => handleUpstreamChange(index, 'weight', Math.min(100, (u.weight ?? 1) + 1))}
                      >+</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[9px] font-bold text-muted-foreground uppercase shrink-0">Enabled</Label>
                    <Switch
                      checked={u.enabled !== false}
                      onCheckedChange={(c) => handleUpstreamChange(index, 'enabled', c)}
                    />
                  </div>
                </div>
              </div>
            ))}

            {formData.config.upstreams.every(u => u.enabled === false) && (
              <div className="flex items-start gap-2 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                <Info className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-[11px] text-destructive">At least one upstream must be enabled.</p>
              </div>
            )}

            {formData.config.upstreams.length > 1 && (
              <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded bg-muted flex items-center justify-center shrink-0">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-blue-800">Load Balancing</Label>
                      <p className="text-[10px] text-muted-foreground">Traffic distribution strategy</p>
                    </div>
                  </div>
                  <select
                    className="flex h-8 w-full sm:w-44 rounded-lg border border-blue-200 bg-background px-3 py-1 text-xs font-bold text-blue-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={formData.config.lb_method}
                    onChange={(e) => updateConfig('lb_method', e.target.value)}
                  >
                    <option value="round-robin">Round Robin</option>
                    <option value="least-conn">Least Connections</option>
                    <option value="ip-hash">IP Hash</option>
                  </select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Listen Port (TCP/UDP only) */}
      {formData.config.upstreams.length > 0 &&
        (formData.config.upstreams[0].scheme === 'tcp' || formData.config.upstreams[0].scheme === 'udp') && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Stream Listen Port</h2>
          <Card className="shadow-none border-border">
            <CardContent className="p-6 space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-[11px] text-foreground leading-relaxed font-medium">
                  TCP/UDP apps require a dedicated port. Clients connect via{' '}
                  <code className="px-1 py-0.5 bg-muted rounded text-[14px] font-mono font-bold">
                    {formData.domain || 'domain.com'}:{formData.config.listen_port || 'auto'}
                  </code>
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Listen Port</Label>
                <Input
                  type="number"
                  value={formData.config.listen_port || ''}
                  onChange={(e) => updateConfig('listen_port', parseInt(e.target.value) || 0)}
                  placeholder="Auto (leave empty)"
                  className="h-9 text-xs border-input max-w-[200px]"
                  min={10000}
                  max={19999}
                />
                <p className="text-[10px] text-muted-foreground">Range 10000-19999. Leave empty for auto-assign.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Health Check (HTTP/HTTPS only) */}
      {!(formData.config.upstreams.length > 0 &&
        (formData.config.upstreams[0].scheme === 'tcp' || formData.config.upstreams[0].scheme === 'udp')) && (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Health Check</h2>
        <Card className="shadow-none border-border">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold">Enable Health Check</Label>
                <p className="text-[10px] text-muted-foreground">Automatically mark unhealthy upstreams out of rotation</p>
              </div>
              <Switch
                checked={formData.config.health_check?.enabled || false}
                onCheckedChange={(c) => updateConfig('health_check', { ...formData.config.health_check, enabled: c })}
              />
            </div>
            {formData.config.health_check?.enabled && (
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Health Check Path</Label>
                  <Input
                    value={formData.config.health_check.path}
                    onChange={(e) => updateConfig('health_check', { ...formData.config.health_check, path: e.target.value })}
                    placeholder="/health"
                    className="h-9 text-xs border-input font-mono"
                  />
                  <p className="text-[9px] text-muted-foreground">Endpoint that returns 2xx when upstream is healthy</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Interval (sec)</Label>
                    <Input
                      type="number"
                      value={formData.config.health_check.interval}
                      onChange={(e) => updateConfig('health_check', { ...formData.config.health_check, interval: parseInt(e.target.value) || 30 })}
                      className="h-9 text-xs border-input font-mono"
                    />
                    <p className="text-[9px] text-muted-foreground">How often to probe</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Fail Threshold</Label>
                    <Input
                      type="number"
                      value={formData.config.health_check.threshold}
                      onChange={(e) => updateConfig('health_check', { ...formData.config.health_check, threshold: parseInt(e.target.value) || 3 })}
                      className="h-9 text-xs border-input font-mono"
                    />
                    <p className="text-[9px] text-muted-foreground">Failures before marking unhealthy</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {/* HTTPS Redirect (HTTP/HTTPS only) */}
      {!(formData.config.upstreams.length > 0 &&
        (formData.config.upstreams[0].scheme === 'tcp' || formData.config.upstreams[0].scheme === 'udp')) && (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">HTTPS Redirect</h2>
        <Card className="shadow-none border-border">
          <CardContent className="p-6">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold">Force HTTPS</Label>
                <p className="text-[10px] text-muted-foreground">Redirect all HTTP requests to HTTPS (301)</p>
              </div>
              <Switch
                checked={formData.config.redirect_https || false}
                onCheckedChange={(c) => updateConfig('redirect_https', c)}
              />
            </div>
            {formData.config.redirect_https && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[10px] text-muted-foreground">
                  Requires a valid SSL certificate for this domain. Configure SSL in the SSL Manager.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  )
}
