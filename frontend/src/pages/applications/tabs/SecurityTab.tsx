import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { Info } from 'lucide-react'
import type { AppConfig, RateLimitProfile } from '@/lib/api-client'

interface SecurityTabProps {
  config: AppConfig
  updateConfig: (key: keyof AppConfig, value: any) => void
}

export function SecurityTab({ config, updateConfig }: SecurityTabProps) {
  const handleRateLimitChange = (index: number, field: keyof RateLimitProfile, value: any) => {
    const next = [...(config.rate_limits || [])]
    next[index] = { ...next[index], [field]: value }
    updateConfig('rate_limits', next)
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Bot Protection */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Bot Protection</h2>
        <Card className="shadow-none border-border">
          <CardContent className="p-5">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Bot detection scores are contributed to the <strong>Scoring Engine</strong>. Challenge and block decisions are made globally based on cumulative risk score.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* WAF Engine */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">WAF Engine</h2>
          <SegmentedControl
            value={config.use_global_waf ? 'global' : 'custom'}
            onValueChange={(val) => updateConfig('use_global_waf', val === 'global')}
            options={[
              { value: 'global', label: 'Global' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </div>
        <Card className="shadow-none border-border">
          <CardContent className="p-5">
            {config.use_global_waf ? (
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Using <strong>Global WAF Defaults</strong>. Scoring thresholds and actions are inherited.
                </p>
              </div>
            ) : config.waf && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Inbound Score Threshold</Label>
                  <Input
                    type="number"
                    value={config.waf.score_threshold}
                    onChange={(e) => updateConfig('waf', { ...config.waf, score_threshold: parseInt(e.target.value) || 0 })}
                    className="h-9 text-xs border-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Outbound Score Threshold</Label>
                  <Input
                    type="number"
                    value={config.waf.outbound_score_threshold || 4}
                    onChange={(e) => updateConfig('waf', { ...config.waf, outbound_score_threshold: parseInt(e.target.value) || 0 })}
                    placeholder="4 (default)"
                    className="h-9 text-xs border-input"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rate Limiting */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Rate Limiting</h2>
          <SegmentedControl
            value={config.use_global_rate_limit ? 'global' : 'custom'}
            onValueChange={(val) => updateConfig('use_global_rate_limit', val === 'global')}
            options={[
              { value: 'global', label: 'Global' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
        </div>
        <Card className="shadow-none border-border">
          <CardContent className="p-5">
            {config.use_global_rate_limit ? (
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Using <strong>Global Rate Limit</strong>. Flood protection thresholds are inherited from system settings.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {(config.rate_limits || []).map((rl, index) => (
                  <div key={index} className="p-4 bg-muted/30 rounded-xl border border-border space-y-4">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-bold text-foreground block">
                          {rl.type === 'BasicAccess' ? 'Basic Access Limit' :
                           rl.type === 'Attack' ? 'Attack Limit' :
                           rl.type === 'Error' ? 'Error Limit' : rl.type + ' Limit'}
                        </span>
                        <p className="text-[9px] text-muted-foreground font-medium">Threshold for {rl.type.toLowerCase()} protection</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Reqs</Label>
                        <Input
                          type="number"
                          value={rl.count}
                          onChange={(e) => handleRateLimitChange(index, 'count', parseInt(e.target.value) || 0)}
                          className="h-9 text-xs border-input"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Window (s)</Label>
                        <Input
                          type="number"
                          value={rl.duration}
                          onChange={(e) => handleRateLimitChange(index, 'duration', parseInt(e.target.value) || 0)}
                          className="h-9 text-xs border-input"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Chall. (s)</Label>
                        <Input
                          type="number"
                          value={rl.challenge_sec}
                          onChange={(e) => handleRateLimitChange(index, 'challenge_sec', parseInt(e.target.value) || 0)}
                          className="h-9 text-xs border-input"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Action</Label>
                      <Select
                        value={rl.action || 'block'}
                        onChange={(e) => handleRateLimitChange(index, 'action', e.target.value)}
                        className="h-9 text-xs"
                      >
                        <option value="block">Block</option>
                        <option value="challenge">Challenge</option>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
