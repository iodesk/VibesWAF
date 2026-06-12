import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs } from '@/components/ui/tabs'
import {
  ShieldAlert,
  ShieldCheck,
  Activity,
  Zap,
  Info,
  Save,
  AlertTriangle
} from 'lucide-react'
import { useWAFConfig, useUpdateWAFConfig, useLogs, useWAFStats } from '@/hooks/useApi'
import { useToast } from '@/components/ui/toast'

function extractWAFRuleID(log: any): string {
  if (!log.pipeline_trace) return ''
  try {
    const trace = JSON.parse(log.pipeline_trace)
    const wafStage = trace.stages?.find((s: any) => s.stage === 'waf_anomaly' && s.score > 0)
    if (!wafStage) return ''
    return wafStage.rule_id || ''
  } catch {
    return ''
  }
}

export default function WAFEngine() {
  const { data: wafConfig, isLoading: isConfigLoading } = useWAFConfig()
  const { data: wafLogsResponse, isLoading: isWafLogsLoading } = useLogs({ limit: 100, trace_like: 'waf_anomaly","score":' })
  const { data: wafStats } = useWAFStats('7d')
  const updateWAFConfig = useUpdateWAFConfig()
  const { addToast } = useToast()
  const wafLogs = wafLogsResponse?.data || []

  const [paranoiaLevel, setParanoiaLevel] = useState<number>(1)
  const [anomalyThreshold, setAnomalyThreshold] = useState<number>(5)
  const [outboundAnomalyThreshold, setOutboundAnomalyThreshold] = useState<number>(4)
  const [allowedMethods, setAllowedMethods] = useState<string[]>(['GET', 'HEAD', 'POST', 'OPTIONS'])
  const [disabledRules, setDisabledRules] = useState<string>('920274, 942421')
  const [customRules, setCustomRules] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'paranoia' | 'scoring' | 'methods' | 'custom'>('paranoia')

  useEffect(() => {
    if (wafConfig) {
      setParanoiaLevel(wafConfig.paranoia_level || 1)
      setAnomalyThreshold(wafConfig.anomaly_threshold || 5)
      setOutboundAnomalyThreshold(wafConfig.outbound_anomaly_threshold || 4)
      setAllowedMethods(wafConfig.allowed_methods || ['GET', 'HEAD', 'POST', 'OPTIONS'])
      setDisabledRules(wafConfig.disabled_rules?.join(', ') || '920274, 942421')
      setCustomRules(wafConfig.custom_rules || '')
    }
  }, [wafConfig])

  const handleSave = async () => {
    try {
      const parsedDisabledRules = disabledRules
        .split(',')
        .map(r => parseInt(r.trim()))
        .filter(r => !isNaN(r))

      await updateWAFConfig.mutateAsync({
        paranoia_level: paranoiaLevel,
        anomaly_threshold: anomalyThreshold,
        outbound_anomaly_threshold: outboundAnomalyThreshold,
        allowed_methods: allowedMethods,
        disabled_rules: parsedDisabledRules,
        custom_rules: customRules,
      })
      addToast('WAF settings updated successfully', 'success')
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update WAF settings'
      addToast(errorMessage, 'error')
    }
  }

  if (isConfigLoading) {
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
        <div className="border border-border rounded-lg p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-muted rounded animate-pulse"></div>
              <div className="h-10 w-full bg-muted/50 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground tracking-tight">WAF Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">OWASP Core Rule Set v4 with Anomaly Scoring</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Engine Status</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full status-active" />
                  <span className="text-lg font-bold text-foreground uppercase tracking-tight">Active</span>
                </div>
              </div>
              <div className="p-2 rounded-md icon-container-success">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Detections</p>
                <div className="text-xl font-bold mt-1 text-foreground">{wafLogs?.length || 0}</div>
              </div>
              <div className="p-2 rounded-md icon-container-primary">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Blocked</p>
                <div className="text-xl font-bold mt-1 text-foreground">
                  {(wafStats?.blocked ?? 0)}
                </div>
              </div>
              <div className="p-2 rounded-md icon-container-danger">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Challenged</p>
                <div className="text-xl font-bold mt-1 text-foreground">
                  {(wafStats?.challenged ?? 0)}
                </div>
              </div>
              <div className="p-2 rounded-md icon-container-warning">
                <Zap className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration with Tabs */}
      <Card className="shadow-none border-border overflow-hidden">
        <CardHeader className="py-5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold">OWASP CRS Configuration</CardTitle>
            <Button
              onClick={handleSave}
              className="btn-primary hover:opacity-90 shadow-none px-6 h-9"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full">
            <div className="mb-6 px-6 pt-6">
              <Tabs
                value={activeTab}
                onValueChange={(val) => setActiveTab(val as 'paranoia' | 'scoring' | 'methods' | 'custom')}
                tabs={[
                  { value: 'paranoia', label: 'Paranoia' },
                  { value: 'scoring', label: 'Scoring' },
                  { value: 'methods', label: 'Methods & Rules' },
                  { value: 'custom', label: 'Custom Rules' },
                ]}
              />
            </div>

            {activeTab === 'paranoia' && (
              <div className="px-6 pb-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold text-foreground">Paranoia Level</Label>
                    <p className="text-[10px] text-muted-foreground mt-1">Higher levels enable more rules but may increase false positives</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { level: 1, label: 'Low', desc: 'Basic protection', color: 'success' },
                      { level: 2, label: 'Medium', desc: 'Balanced security', color: 'primary' },
                      { level: 3, label: 'High', desc: 'Aggressive rules', color: 'warning' },
                      { level: 4, label: 'Paranoid', desc: 'Maximum security', color: 'danger' }
                    ].map(({ level, label, desc, color }) => (
                      <button
                        key={level}
                        onClick={() => setParanoiaLevel(level)}
                        title={desc}
                        className={`relative p-3 sm:p-4 rounded-lg border-2 transition-all text-left ${
                          paranoiaLevel === level
                            ? color === 'success' ? 'border-green-500 bg-green-500/10' :
                              color === 'primary' ? 'border-blue-500 bg-blue-500/10' :
                              color === 'warning' ? 'border-yellow-500 bg-yellow-500/10' :
                              'border-red-500 bg-red-500/10'
                            : 'border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                          <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider ${
                            paranoiaLevel === level
                              ? color === 'success' ? 'text-green-600' :
                                color === 'primary' ? 'text-blue-600' :
                                color === 'warning' ? 'text-yellow-600' :
                                'text-red-600'
                              : 'text-muted-foreground'
                          }`}>
                            PL{level}
                          </span>
                          {paranoiaLevel === level && (
                            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                              color === 'success' ? 'bg-green-500' :
                              color === 'primary' ? 'bg-blue-500' :
                              color === 'warning' ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`} />
                          )}
                        </div>
                        <div className={`text-xs sm:text-sm font-bold mb-0.5 sm:mb-1 ${
                          paranoiaLevel === level ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                          {label}
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-muted-foreground leading-tight">
                          {desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <div className="flex gap-3">
                    <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-foreground">
                        {paranoiaLevel === 1 && 'PL1: Basic Protection - Recommended for most applications'}
                        {paranoiaLevel === 2 && 'PL2: Standard Protection - Balanced security for production'}
                        {paranoiaLevel === 3 && 'PL3: High Protection - Aggressive, requires tuning'}
                        {paranoiaLevel === 4 && 'PL4: Maximum Protection - Highest security, high false positives'}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        {paranoiaLevel === 1 && 'Low false positive rate with essential security coverage.'}
                        {paranoiaLevel === 2 && 'Moderate false positive rate, good for production environments.'}
                        {paranoiaLevel === 3 && 'Higher false positive rate, requires careful tuning.'}
                        {paranoiaLevel === 4 && 'Highest false positive rate, only for high-security environments.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'scoring' && (
              <div className="px-6 pb-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Anomaly Threshold */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Inbound Anomaly Score Threshold</Label>
                      <p className="text-[10px] text-muted-foreground mt-1">Request blocked when score exceeds threshold</p>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={anomalyThreshold}
                        onChange={(e) => setAnomalyThreshold(parseInt(e.target.value) || 0)}
                        className="h-12 bg-background border-input pl-4 pr-16 font-mono text-lg font-bold"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">POINTS</div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Default: 5. Lower = stricter, Higher = permissive</span>
                    </div>
                  </div>

                  {/* Outbound Anomaly Threshold */}
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold text-foreground">Outbound Anomaly Score Threshold</Label>
                      <p className="text-[10px] text-muted-foreground mt-1">Response blocked when score exceeds threshold</p>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={outboundAnomalyThreshold}
                        onChange={(e) => setOutboundAnomalyThreshold(parseInt(e.target.value) || 0)}
                        className="h-12 bg-background border-input pl-4 pr-16 font-mono text-lg font-bold"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">POINTS</div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Default: 4. Detects data leakage</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg border border-border">
                  <div className="flex gap-3">
                    <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold text-foreground">About WAF Anomaly Scoring</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Each CRS rule match adds points. The WAF anomaly score is contributed to the adaptive scoring engine.
                        Final action (block/challenge) is determined by the Scoring Engine thresholds, not here.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'methods' && (
              <div className="px-6 pb-6 space-y-6">
                {/* Allowed Methods */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold text-foreground">Allowed HTTP Methods</Label>
                    <p className="text-[10px] text-muted-foreground mt-1">HTTP methods that are allowed by the WAF</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'CONNECT'].map((method) => (
                      <label
                        key={method}
                        className="flex items-center gap-2 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={allowedMethods.includes(method)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAllowedMethods([...allowedMethods, method])
                            } else {
                              setAllowedMethods(allowedMethods.filter(m => m !== method))
                            }
                          }}
                          className="w-4 h-4 rounded border-input"
                        />
                        <span className="text-xs font-bold text-foreground font-mono">{method}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Info className="w-3 h-3" />
                    <span>Default: GET, HEAD, POST, OPTIONS</span>
                  </div>
                </div>

                {/* Disabled Rules */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold text-foreground">Disabled OWASP CRS Rules</Label>
                    <p className="text-[10px] text-muted-foreground mt-1">Rule IDs to disable (comma-separated)</p>
                  </div>
                  <Input
                    type="text"
                    value={disabledRules}
                    onChange={(e) => setDisabledRules(e.target.value)}
                    placeholder="920274, 942421"
                    className="h-10 bg-background border-input font-mono text-sm"
                  />
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Info className="w-3 h-3" />
                    <span>Default: 920274, 942421 (Cloudflare compatibility)</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'custom' && (
              <div className="px-6 pb-6 space-y-6">
                {/* Custom Rules */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold text-foreground">Custom Coraza Rules</Label>
                    <p className="text-[10px] text-muted-foreground mt-1">Advanced: Add custom SecRule directives. Loaded after OWASP CRS rules.</p>
                  </div>
                  <Textarea
                    value={customRules}
                    onChange={(e) => setCustomRules(e.target.value)}
                    placeholder="# Example: Block specific user agent&#10;SecRule REQUEST_HEADERS:User-Agent &quot;@contains badbot&quot; \&#10;  &quot;id:100001,phase:1,deny,status:403,msg:'Bad bot blocked'&quot;&#10;&#10;# Example: Whitelist specific IP&#10;SecRule REMOTE_ADDR &quot;@ipMatch 192.168.1.100&quot; \&#10;  &quot;id:100002,phase:1,pass,nolog,ctl:ruleEngine=Off&quot;"
                    className="min-h-[300px] bg-background border-input font-mono text-xs resize-y"
                  />
                  <div className="p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="flex gap-3">
                      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-foreground">Advanced Feature</p>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Use Coraza/ModSecurity syntax. Invalid rules will cause WAF initialization to fail. 
                          Test carefully before applying to production. 
                          <a href="https://coraza.io/docs/seclang/directives/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                            View Coraza documentation →
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Analytics Section */}
      <Card className="shadow-none border-border">
        <CardHeader className="py-5 border-b border-border/50 bg-muted/30">
          <CardTitle className="text-sm font-bold">Recent Attack Detections</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isWafLogsLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading logs...</div>
          ) : wafLogs && wafLogs.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-card rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Detections</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{wafLogs?.length || 0}</p>
                    </div>
                    <Activity className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                </div>
                <div className="p-4 bg-card rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Blocked</p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {(wafStats?.blocked ?? 0)}
                      </p>
                    </div>
                    <ShieldAlert className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                </div>
                <div className="p-4 bg-card rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Challenged</p>
                      <p className="text-2xl font-bold text-foreground mt-1">
                        {(wafStats?.challenged ?? 0)}
                      </p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                </div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
                      <tr>
                        <th className="text-left p-3 font-bold text-muted-foreground">Time</th>
                        <th className="text-left p-3 font-bold text-muted-foreground">IP Address</th>
                        <th className="text-left p-3 font-bold text-muted-foreground">Country</th>
                        <th className="text-left p-3 font-bold text-muted-foreground">Action</th>
                        <th className="text-left p-3 font-bold text-muted-foreground">Path</th>
                        <th className="text-left p-3 font-bold text-muted-foreground">CRS Rule ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {wafLogs.slice(0, 10).map((log, i) => {
                        const wafRuleId = extractWAFRuleID(log)
                        return (
                          <tr key={i} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 text-muted-foreground font-mono">
                              {new Date(log.ts).toLocaleTimeString()}
                            </td>
                            <td className="p-3 font-mono font-bold text-foreground">{log.ip}</td>
                            <td className="p-3 text-muted-foreground">{log.country || '-'}</td>
                            <td className="p-3">
                              <Badge className={`text-[9px] font-bold py-0.5 px-2 rounded-full border-none ${
                                log.action === 'block' ? 'action-block' :
                                log.action === 'challenge' ? 'action-challenge' : 'action-allow'
                              }`}>
                                {log.action}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground truncate max-w-xs">{log.path}</td>
                            <td className="p-3 font-mono text-muted-foreground">
                              {wafRuleId || 'N/A'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground italic">
              No WAF detections yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
