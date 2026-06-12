import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Save,
  Info,
  Target,
  Sliders,
  ShieldCheck,
  ArrowDown,
  Zap,
  Ban,
  CheckCircle2,
} from 'lucide-react'
import { useScoringConfig, useUpdateScoringConfig } from '@/hooks/useApi'
import { useToast } from '@/components/ui/toast'
import type { ScoringConfig } from '@/lib/api-client'

const CATEGORY_META = [
  { key: 'ip_reputation', label: 'IP Reputation', desc: 'Datacenter ASN, cloud provider, proxy/VPN detection' },
  { key: 'bot_detection', label: 'Bot Detection', desc: 'Header analysis, UA patterns, behavioral signals' },
  { key: 'waf_anomaly', label: 'WAF Anomaly', desc: 'OWASP CRS anomaly scoring from Coraza engine' },
  { key: 'protocol_anomaly', label: 'Protocol Anomaly', desc: 'JA3 mismatch, header inconsistency, cookie anomaly' },
] as const

type CategoryKey = typeof CATEGORY_META[number]['key']

export default function ScoringEngine() {
  const { data: scoringConfig, isLoading } = useScoringConfig()
  const updateConfig = useUpdateScoringConfig()
  const { addToast } = useToast()

  const [config, setConfig] = useState<ScoringConfig | null>(null)

  useEffect(() => {
    if (scoringConfig) {
      setConfig(structuredClone(scoringConfig))
    }
  }, [scoringConfig])

  const handleSave = async () => {
    if (!config) return
    try {
      await updateConfig.mutateAsync(config)
      addToast('Scoring configuration updated', 'success')
    } catch (error: any) {
      addToast(error?.message || 'Failed to update scoring config', 'error')
    }
  }

  const updateThreshold = (field: keyof ScoringConfig['thresholds'], value: number) => {
    if (!config) return
    setConfig({ ...config, thresholds: { ...config.thresholds, [field]: value } })
  }

  const updateWeight = (category: CategoryKey, field: keyof ScoringConfig['weights'][CategoryKey], value: number | boolean) => {
    if (!config) return
    setConfig({
      ...config,
      weights: {
        ...config.weights,
        [category]: { ...config.weights[category], [field]: value },
      },
    })
  }

  const updateTrust = (field: keyof ScoringConfig['trust'], value: number) => {
    if (!config) return
    setConfig({ ...config, trust: { ...config.trust, [field]: value } })
  }

  if (isLoading || !config) {
    return (
      <div className="space-y-6 animate-in">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted/50 rounded animate-pulse" />
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-border rounded-lg p-6">
              <div className="h-4 w-32 bg-muted rounded animate-pulse mb-4" />
              <div className="h-10 w-full bg-muted/50 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const totalMaxPossible = CATEGORY_META.reduce(
    (sum, c) => sum + (config.weights[c.key].enabled ? config.weights[c.key].max_score : 0), 0
  )

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Scoring Engine</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Adaptive risk scoring configure thresholds and category weights
          </p>
        </div>
        <Button onClick={handleSave} className="btn-primary hover:opacity-90 shadow-none px-6 h-9">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>

      {/* 2-column layout: config left, flow right (desktop) */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Left column Configuration */}
        <div className="space-y-6">

          {/* Decision Thresholds */}
          <Card className="shadow-none border-border overflow-hidden">
            <CardHeader className="py-5 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-bold">Decision Thresholds</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex gap-3">
                  <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    When the cumulative risk score reaches a threshold, the corresponding action is triggered.
                    Thresholds must be ordered: Block &gt; Challenge &gt; Allow.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'block' as const, label: 'Block', desc: '403 Forbidden', color: 'text-red-600' },
                  { key: 'challenge' as const, label: 'Challenge', desc: 'Browser Integrity Check', color: 'text-amber-600' },
                ].map(({ key, label, desc, color }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className={`text-xs font-bold ${color}`}>{label}</Label>
                      <span className="text-[10px] text-muted-foreground">{desc}</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={config.thresholds[key]}
                        onChange={(e) => updateThreshold(key, parseInt(e.target.value) || 0)}
                        className="h-12 bg-background border-input pl-4 pr-16 font-mono text-lg font-bold"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">
                        / 100
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Visual threshold bar */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Score Scale</Label>
                <div className="relative h-8 rounded-lg overflow-hidden border border-border bg-muted/30">
                  <div className="absolute inset-0 flex">
                    <div className="bg-emerald-500/10 border-r border-border/50" style={{ width: `${config.thresholds.challenge}%` }} />
                    <div className="bg-amber-500/10 border-r border-border/50" style={{ width: `${config.thresholds.block - config.thresholds.challenge}%` }} />
                    <div className="bg-red-500/10 flex-1" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-between px-4">
                    <span className="text-[9px] font-bold text-emerald-600">ALLOW</span>
                    <span className="text-[9px] font-bold text-amber-600">CHALLENGE</span>
                    <span className="text-[9px] font-bold text-red-600">BLOCK</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category Weights */}
          <Card className="shadow-none border-border overflow-hidden">
            <CardHeader className="py-5 border-b border-border/50 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-bold">Category Weights</CardTitle>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Max possible: {totalMaxPossible}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {CATEGORY_META.map(({ key, label, desc }) => {
                  const weight = config.weights[key]
                  return (
                    <div key={key} className="p-5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={weight.enabled}
                              onCheckedChange={(checked) => updateWeight(key, 'enabled', checked)}
                              className="scale-90"
                            />
                            <div>
                              <p className="text-xs font-bold text-foreground">{label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-muted-foreground uppercase">Max Score</Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={weight.max_score}
                              onChange={(e) => updateWeight(key, 'max_score', parseInt(e.target.value) || 0)}
                              disabled={!weight.enabled}
                              className="w-20 h-8 text-xs font-mono font-bold border-input"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-muted-foreground uppercase">Multiplier</Label>
                            <Input
                              type="number"
                              min={0}
                              max={5}
                              step={0.1}
                              value={weight.multiplier}
                              onChange={(e) => updateWeight(key, 'multiplier', parseFloat(e.target.value) || 0)}
                              disabled={!weight.enabled}
                              className="w-20 h-8 text-xs font-mono font-bold border-input"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Trust Reduction */}
          <Card className="shadow-none border-border overflow-hidden">
            <CardHeader className="py-5 border-b border-border/50 bg-muted/30">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm font-bold">Trust Reduction</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex gap-3">
                  <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Trust signals reduce the total risk score. Verified users get lower scores,
                    reducing false positives for legitimate traffic. Use negative values.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border/50">
                {[
                  { key: 'trusted_history' as const, label: 'Trusted History', desc: 'Known good behavior over time' },
                  { key: 'stable_session' as const, label: 'Stable Session', desc: 'Consistent session fingerprint' },
                  { key: 'good_bot' as const, label: 'Good Bot', desc: 'Verified crawler (Googlebot, Bingbot)' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {key === 'trusted_history' && (
                        <div className="space-y-1">
                          <Label className="text-[9px] font-bold text-muted-foreground uppercase">Threshold</Label>
                          <Input
                            type="number"
                            min={1}
                            max={1000}
                            value={config.trust.trusted_history_threshold}
                            onChange={(e) => updateTrust('trusted_history_threshold', parseInt(e.target.value) || 50)}
                            className="w-20 h-8 text-xs font-mono font-bold border-input text-center"
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-[9px] font-bold text-muted-foreground uppercase">Reduction</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            max={0}
                            min={-50}
                            value={config.trust[key]}
                            onChange={(e) => updateTrust(key, parseInt(e.target.value) || 0)}
                            className="w-20 h-8 text-xs font-mono font-bold border-input pr-8"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-600">pts</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column Flow Engine (desktop only) */}
        <div className="hidden xl:block">
          <Card className="shadow-none border-border overflow-hidden sticky top-6">
            <CardHeader className="py-5 border-b border-border/50 bg-muted/30">
              <CardTitle className="text-sm font-bold">Pipeline Flow</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-3">
                {/* Request */}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                    <Zap className="w-3.5 h-3.5 text-foreground" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-foreground">Request Incoming</p>
                    <p className="text-[9px] text-muted-foreground">Normalized, GeoIP resolved</p>
                  </div>
                </div>

                <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-muted-foreground/50" /></div>

                {/* Phase 1 */}
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded bg-red-500/10 flex items-center justify-center">
                      <Ban className="w-3 h-3 text-red-600" />
                    </div>
                    <p className="text-[11px] font-bold text-foreground">Phase 1 Hard Rules</p>
                  </div>
                  <div className="space-y-1.5 pl-7">
                    <p className="text-[10px] text-muted-foreground">• IP Access Rules</p>
                    <p className="text-[10px] text-muted-foreground">• Rate Limit</p>
                    <p className="text-[10px] text-muted-foreground">• Flood Protection</p>
                    <p className="text-[10px] text-muted-foreground">• Decision Cache</p>
                    <p className="text-[10px] text-muted-foreground">• Custom Rules (block/challenge)</p>
                  </div>
                  <div className="mt-2 pl-7 space-y-1">
                    <span className="text-[9px] font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded">
                      MATCH → BLOCK & STOP
                    </span>
                  </div>
                </div>

                <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-muted-foreground/50" /></div>

                {/* Flood Behavioral Info */}
                <div className="p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded bg-orange-500/10 flex items-center justify-center">
                      <Zap className="w-3 h-3 text-orange-600" />
                    </div>
                    <p className="text-[11px] font-bold text-foreground">Behavioral Recording</p>
                  </div>
                  <div className="space-y-1.5 pl-7">
                    <p className="text-[10px] text-muted-foreground">• Attack Flood: WAF violations tracked per IP</p>
                    <p className="text-[10px] text-muted-foreground">• Error Flood: upstream 4xx/5xx tracked per IP</p>
                  </div>
                  <div className="mt-2 pl-7">
                    <span className="text-[9px] font-bold text-orange-600 bg-orange-500/10 px-2 py-0.5 rounded">
                      POST-RESPONSE → feeds Flood Protection
                    </span>
                  </div>
                </div>

                <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-muted-foreground/50" /></div>

                {/* Phase 2 */}
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded bg-blue-500/10 flex items-center justify-center">
                      <Sliders className="w-3 h-3 text-blue-600" />
                    </div>
                    <p className="text-[11px] font-bold text-foreground">Phase 2 Scoring</p>
                  </div>
                  <div className="space-y-1.5 pl-7">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">• IP Reputation</p>
                      <span className="text-[9px] font-mono text-muted-foreground">+{config.weights.ip_reputation.max_score} max</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">• Bot Detection</p>
                      <span className="text-[9px] font-mono text-muted-foreground">+{config.weights.bot_detection.max_score} max</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">• WAF Anomaly</p>
                      <span className="text-[9px] font-mono text-muted-foreground">+{config.weights.waf_anomaly.max_score} max</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-muted-foreground">• Protocol Anomaly</p>
                      <span className="text-[9px] font-mono text-muted-foreground">+{config.weights.protocol_anomaly.max_score} max</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border/50 pt-1.5 mt-1.5">
                      <p className="text-[10px] text-emerald-600 font-medium">• Trust Reduction</p>
                      <span className="text-[9px] font-mono text-emerald-600">active</span>
                    </div>
                  </div>
                  <div className="mt-2 pl-7">
                    <span className="text-[9px] font-bold text-emerald-600 bg-blue-500/10 px-2 py-0.5 rounded">
                      CUMULATIVE → total score
                    </span>
                  </div>
                </div>

                <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-muted-foreground/50" /></div>

                {/* Phase 3 */}
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded bg-amber-500/10 flex items-center justify-center">
                      <Target className="w-3 h-3 text-amber-600" />
                    </div>
                    <p className="text-[11px] font-bold text-foreground">Phase 3 Decision</p>
                  </div>
                  <div className="space-y-1.5 pl-7">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-red-600 font-medium">≥ {config.thresholds.block}</p>
                      <span className="text-[9px] font-bold text-red-600">BLOCK</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-amber-600 font-medium">≥ {config.thresholds.challenge}</p>
                      <span className="text-[9px] font-bold text-amber-600">CHALLENGE</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] text-emerald-600 font-medium">&lt; {config.thresholds.challenge}</p>
                      <span className="text-[9px] font-bold text-emerald-600">ALLOW</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-muted-foreground/50" /></div>

                {/* Phase 4 */}
                <div className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-foreground">Phase 4 Response</p>
                    <p className="text-[9px] text-muted-foreground">Block page / Challenge / Proxy upstream</p>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Legend</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-600" />
                      <span className="text-[10px] text-muted-foreground">Hard rules: instant, deterministic</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-600" />
                      <span className="text-[10px] text-muted-foreground">Behavioral: post-response IP tracking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-600" />
                      <span className="text-[10px] text-muted-foreground">Scoring: cumulative, all stages run</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-600" />
                      <span className="text-[10px] text-muted-foreground">Decision: score vs thresholds</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-600" />
                      <span className="text-[10px] text-muted-foreground">Response: serve action to client</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
