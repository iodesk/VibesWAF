import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Save, AlertTriangle, Shield, Cookie } from 'lucide-react'
import { useProtocolAnomalyConfig, useUpdateProtocolAnomalyConfig } from '@/hooks/useApi'
import { useToast } from '@/components/ui/toast'
import type { ProtocolAnomalyConfig } from '@/lib/api-client'

const RULE_META: Record<string, { label: string; description: string; category: string }> = {
  http2_connection_header: { label: 'HTTP/2 Connection Header', description: 'HTTP/2 request contains Connection header (protocol violation)', category: 'header' },
  content_type_no_body: { label: 'Content-Type on GET/HEAD', description: 'Content-Type header present on request with no body', category: 'header' },
  accept_path_mismatch: { label: 'Accept vs Path Mismatch', description: 'Accept: text/html but path is API or data endpoint', category: 'header' },
  sec_fetch_dest_mismatch: { label: 'Sec-Fetch-Dest Mismatch', description: 'Sec-Fetch-Dest: document but path is asset or API', category: 'header' },
  upgrade_non_navigate: { label: 'Upgrade on Non-Navigate', description: 'Upgrade-Insecure-Requests present but not a navigation request', category: 'header' },
  te_cl_conflict: { label: 'TE + CL Conflict', description: 'Both Transfer-Encoding and Content-Length present (smuggling indicator)', category: 'header' },
  multiple_host_headers: { label: 'Multiple Host Headers', description: 'Multiple Host headers detected (smuggling/spoofing)', category: 'header' },
  malformed_challenge_cookie: { label: 'Malformed Challenge Cookie', description: 'Challenge cookie present but format is invalid', category: 'cookie' },
  future_cookie_timestamp: { label: 'Future Cookie Timestamp', description: 'Challenge cookie timestamp is in the future', category: 'cookie' },
  excessive_cookies_no_referer: { label: 'Excessive Cookies (No Referer)', description: 'More than 10 cookies on root path with no referer', category: 'cookie' },
  ja4_old_tls_browser_ua: { label: 'Old TLS + Browser UA', description: 'UA claims modern browser but TLS version is 1.0/1.1 (browsers dropped these)', category: 'ja4' },
  browser_ua_http10: { label: 'Browser UA + HTTP/1.0', description: 'UA claims modern browser but using HTTP/1.0 protocol', category: 'ja4' },
  browser_ua_ja4_empty: { label: 'Browser UA + JA4 Empty', description: 'HTTPS request with browser UA but no JA4 fingerprint (unusual)', category: 'ja4' },
  bot_ua_browser_ja4: { label: 'Bot UA + Browser JA4', description: 'UA claims bot but JA4 shows browser-like TLS stack (high cipher count)', category: 'ja4' },
  browser_ua_simple_ja4: { label: 'Browser UA + Simple JA4', description: 'UA claims browser but JA4 shows simple TLS client (low cipher count)', category: 'ja4' },
}

export default function AnomalyBehavior() {
  const { data: config, isLoading } = useProtocolAnomalyConfig()
  const updateConfig = useUpdateProtocolAnomalyConfig()
  const { addToast } = useToast()

  const [formData, setFormData] = useState<ProtocolAnomalyConfig | null>(null)

  useEffect(() => {
    if (config) {
      setFormData(structuredClone(config))
    }
  }, [config])

  const handleSave = async () => {
    if (!formData) return
    try {
      await updateConfig.mutateAsync(formData)
      addToast('Protocol anomaly configuration updated', 'success')
    } catch (error: any) {
      addToast(error?.message || 'Failed to update configuration', 'error')
    }
  }

  const handleRuleChange = (rule: string, value: number) => {
    if (!formData) return
    setFormData({
      ...formData,
      rules: { ...formData.rules, [rule]: value }
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse"></div>
          <div className="h-4 w-64 bg-muted/50 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="border border-border rounded-lg p-6 space-y-4">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="h-12 w-full bg-muted/50 rounded animate-pulse"></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const headerRules = Object.entries(RULE_META).filter(([, m]) => m.category === 'header')
  const cookieRules = Object.entries(RULE_META).filter(([, m]) => m.category === 'cookie')
  const ja4Rules = Object.entries(RULE_META).filter(([, m]) => m.category === 'ja4')

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Anomaly Behavior</h1>
        <p className="text-sm text-muted-foreground mt-1">Detect protocol-level inconsistencies and cookie anomalies</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-none border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Rules</p>
                <div className="text-xl font-bold mt-1">{formData ? Object.keys(formData.rules).length : 0}</div>
              </div>
              <div className="p-2 rounded-md icon-container-primary">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Header Rules</p>
                <div className="text-xl font-bold mt-1">{headerRules.length}</div>
              </div>
              <div className="p-2 rounded-md icon-container-warning">
                <Shield className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Cookie Rules</p>
                <div className="text-xl font-bold mt-1">{cookieRules.length}</div>
              </div>
              <div className="p-2 rounded-md icon-container-success">
                <Cookie className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header Inconsistency Rules */}
      <Card className="shadow-none border-border">
        <CardHeader className="py-4 border-b border-border/50 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 icon-neutral" />
              <CardTitle className="text-sm font-semibold">Header Inconsistency</CardTitle>
              <Badge className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0 font-bold">{headerRules.length} rules</Badge>
            </div>
            <Button onClick={handleSave} disabled={!formData} className="btn-primary hover:opacity-90 shadow-none px-6 h-9">
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
            {headerRules.map(([key, meta]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">{meta.label}</Label>
                  <Badge className="bg-foreground text-background font-mono text-xs">+{formData?.rules[key] || 0}</Badge>
                </div>
                <Input
                  type="number"
                  value={formData?.rules[key] || 0}
                  onChange={(e) => handleRuleChange(key, parseInt(e.target.value) || 0)}
                  className="h-9 border-input"
                />
                <p className="text-[10px] text-muted-foreground">{meta.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cookie Anomaly Rules */}
      <Card className="shadow-none border-border">
        <CardHeader className="py-4 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Cookie className="w-4 h-4 icon-neutral" />
            <CardTitle className="text-sm font-semibold">Cookie Anomaly</CardTitle>
            <Badge className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0 font-bold">{cookieRules.length} rules</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
            {cookieRules.map(([key, meta]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">{meta.label}</Label>
                  <Badge className="bg-foreground text-background font-mono text-xs">+{formData?.rules[key] || 0}</Badge>
                </div>
                <Input
                  type="number"
                  value={formData?.rules[key] || 0}
                  onChange={(e) => handleRuleChange(key, parseInt(e.target.value) || 0)}
                  className="h-9 border-input"
                />
                <p className="text-[10px] text-muted-foreground">{meta.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* JA4 Fingerprint Rules */}
      <Card className="shadow-none border-border">
        <CardHeader className="py-4 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 icon-neutral" />
            <CardTitle className="text-sm font-semibold">JA4 TLS Fingerprint</CardTitle>
            <Badge className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0 font-bold">{ja4Rules.length} rules</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-6">
            {ja4Rules.map(([key, meta]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">{meta.label}</Label>
                  <Badge className="bg-foreground text-background font-mono text-xs">+{formData?.rules[key] || 0}</Badge>
                </div>
                <Input
                  type="number"
                  value={formData?.rules[key] || 0}
                  onChange={(e) => handleRuleChange(key, parseInt(e.target.value) || 0)}
                  className="h-9 border-input"
                />
                <p className="text-[10px] text-muted-foreground">{meta.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="shadow-none border-border opacity-70">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">How it works</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Protocol anomaly scores contribute to the <strong>Protocol Anomaly</strong> category in the scoring engine.
                Set a rule to 0 to disable it. Scores are capped by the category max score configured in Scoring Engine.
                JA4 TLS fingerprint is extracted by OpenResty and passed via X-JA4 header. More JA4 rules can be added as fingerprint database grows.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
