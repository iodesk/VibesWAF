import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Check,
  Gauge,
  SquarePen,
  X,
  Zap,
  Shield,
  Clock,
  Activity,
  ShieldAlert
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { useRateLimit, useUpdateRateLimit, useRateLimitStats } from '@/hooks/useApi'

type LimitType = 'basic' | 'attack' | 'error'

export default function RateLimiter() {
  const { addToast } = useToast()
  const { data: rateLimitData, isLoading } = useRateLimit()
  const updateRateLimit = useUpdateRateLimit()
  const { data: statsData } = useRateLimitStats()

  const [editingType, setEditingType] = useState<LimitType | null>(null)
  const [editValues, setEditValues] = useState({
    duration: 0,
    count: 0,
    action: 'block',
    challenge_sec: 0,
  })

  const handleToggle = async (type: LimitType) => {
    if (!rateLimitData) return
    const currentConfig = rateLimitData[type]
    try {
      await updateRateLimit.mutateAsync({
        [type]: {
          ...currentConfig,
          enabled: !currentConfig.enabled,
        },
      })
      addToast(`${type.charAt(0).toUpperCase() + type.slice(1)} limit ${!currentConfig.enabled ? 'enabled' : 'disabled'}`, 'success')
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update rate limit'
      addToast(errorMessage, 'error')
    }
  }

  const startEdit = (type: LimitType) => {
    if (!rateLimitData) return
    const config = rateLimitData[type]
    setEditingType(type)
    setEditValues({
      duration: config.duration,
      count: config.count,
      action: config.action || 'block',
      challenge_sec: config.challenge_sec,
    })
  }

  const cancelEdit = () => {
    setEditingType(null)
  }

  const saveEdit = async (type: LimitType) => {
    if (!rateLimitData) return
    try {
      await updateRateLimit.mutateAsync({
        [type]: {
          enabled: rateLimitData[type].enabled,
          duration: editValues.duration,
          count: editValues.count,
          action: editValues.action,
          challenge_sec: editValues.challenge_sec,
        },
      })
      addToast(`${type.charAt(0).toUpperCase() + type.slice(1)} limit updated`, 'success')
      setEditingType(null)
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update rate limit'
      addToast(errorMessage, 'error')
    }
  }

  const enabledCount = rateLimitData ? Object.values(rateLimitData).filter(l => l.enabled).length : 0
  const totalLimits = 3

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse"></div>
          <div className="h-4 w-64 bg-muted/50 rounded animate-pulse"></div>
        </div>
        <div className="border border-border rounded-lg p-6 space-y-4">
          {[...Array(6)].map((_, i) => (
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground tracking-tight">Rate Limiter</h1>
          <p className="text-sm text-muted-foreground mt-1">Global flood protection and request rate control</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Profiles</p>
                <div className="text-xl font-bold mt-1 text-foreground">{totalLimits}</div>
              </div>
              <div className="p-2 rounded-md icon-container-primary">
                <Gauge className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Limits</p>
                <div className="text-xl font-bold mt-1 text-foreground">{enabledCount}</div>
              </div>
              <div className="p-2 rounded-md icon-container-success">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none border-border overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Global Status</p>
                <div className="mt-1">
                  <Badge className={`px-3 py-0.5 border-none shadow-none ${enabledCount > 0 ? 'action-allow' : 'bg-muted text-muted-foreground'}`}>
                    {enabledCount > 0 ? 'PROTECTED' : 'INACTIVE'}
                  </Badge>
                </div>
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
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Default Action</p>
                <div className="text-xl font-bold mt-1 text-foreground capitalize">
                  {rateLimitData?.basic?.action || 'Block'}
                </div>
              </div>
              <div className="p-2 rounded-md icon-container-warning">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Global Rate Limit Settings */}
      <Card className="shadow-none border-border overflow-hidden">
        <CardHeader className="py-5 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-bold">System Flood Protection Profiles</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!rateLimitData ? (
            <div className="py-20 text-center text-muted-foreground text-sm italic">Failed to load configuration</div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/50 z-10">
                    <tr>
                      <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6">Limit Profile</th>
                      <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6">Threshold Configuration</th>
                      <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-36">Action</th>
                      <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-28">Events</th>
                      <th className="text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-32">Status</th>
                      <th className="text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-4 px-6 w-32">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {(['basic', 'attack', 'error'] as LimitType[]).map((type) => {
                      const config = rateLimitData[type]
                      const isEditing = editingType === type

                      return (
                        <tr key={type} className="group hover:bg-muted/30 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <Zap className={`w-3.5 h-3.5 ${type === 'attack' ? 'icon-danger' : type === 'error' ? 'icon-warning' : 'icon-primary'}`} />
                                <span className="font-bold text-xs text-foreground capitalize">
                                  {type} Access Limit
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground pl-5.5">
                                {type === 'basic' ? 'Raw request flood per IP (all requests counted)' :
                                  type === 'attack' ? 'WAF violation repeat offender detection per IP' :
                                    'Upstream error (4xx/5xx) repeat detection per IP'}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {isEditing ? (
                              <div className="flex items-center gap-4">
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-bold text-muted-foreground">DURATION (S)</Label>
                                  <Input
                                    type="number"
                                    value={editValues.duration}
                                    onChange={(e) => setEditValues({ ...editValues, duration: parseInt(e.target.value) || 0 })}
                                    className="w-20 h-8 text-xs border-input"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-bold text-muted-foreground">MAX REQS</Label>
                                  <Input
                                    type="number"
                                    value={editValues.count}
                                    onChange={(e) => setEditValues({ ...editValues, count: parseInt(e.target.value) || 0 })}
                                    className="w-20 h-8 text-xs border-input"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-[9px] font-bold text-muted-foreground">CHALLENGE (S)</Label>
                                  <Input
                                    type="number"
                                    value={editValues.challenge_sec}
                                    onChange={(e) => setEditValues({ ...editValues, challenge_sec: parseInt(e.target.value) || 0 })}
                                    className="w-20 h-8 text-xs border-input"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground font-bold">WINDOW</span>
                                  <span className="font-mono text-xs text-foreground">{config.duration}s</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground font-bold">THRESHOLD</span>
                                  <span className="font-mono text-xs text-foreground">{config.count} Reqs</span>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-muted-foreground font-bold">PENALTY</span>
                                  <span className="font-mono text-xs text-foreground">{config.challenge_sec}s</span>
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-4 px-6">                         
                            {isEditing ? (
                              <Select
                                value={editValues.action}
                                onChange={(e) => setEditValues({ ...editValues, action: e.target.value })}
                                className="w-28 h-8 text-xs"
                              >                                
                                <option value="block">Block</option>
                                <option value="challenge">Challenge</option>
                              </Select>
                            ) : (
                              <Badge className={`px-2 py-0.5 text-[10px] font-bold border-none shadow-none ${config.action === 'block' ? 'action-block' : 'action-challenge'}`}>
                                {(config.action || 'block').toUpperCase()}
                              </Badge>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-sm text-foreground">
                                {statsData ? (statsData[type] ?? 0).toLocaleString() : '0'}                        
                              </span>
                        
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <Switch
                              checked={config.enabled}
                              onCheckedChange={() => handleToggle(type)}
                              className="scale-90"
                            />
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => saveEdit(type)}
                                    className="h-8 w-8 hover:bg-muted"
                                  >
                                    <Check className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={cancelEdit}
                                    className="h-8 w-8 hover:bg-muted"
                                  >
                                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => startEdit(type)}
                                  className="h-8 w-8 hover:bg-muted"
                                >
                                  <SquarePen className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-border/50">
                {(['basic', 'attack', 'error'] as LimitType[]).map((type) => {
                  const config = rateLimitData[type]
                  const isEditing = editingType === type

                  return (
                    <div key={type} className="p-4 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Zap className={`w-4 h-4 ${type === 'attack' ? 'icon-danger' : type === 'error' ? 'icon-warning' : 'icon-primary'}`} />
                            <span className="font-bold text-sm text-foreground capitalize">
                              {type} Access Limit
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground pl-6">
                            {type === 'basic' ? 'Raw request flood per IP (all requests counted)' :
                              type === 'attack' ? 'WAF violation repeat offender detection per IP' :
                                'Upstream error (4xx/5xx) repeat detection per IP'}
                          </p>
                        </div>
                        <Switch
                          checked={config.enabled}
                          onCheckedChange={() => handleToggle(type)}
                          className="scale-90"
                        />
                      </div>

                      {/* Configuration */}
                      {isEditing ? (
                        <div className="space-y-3 bg-muted/50 p-3 rounded-lg">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-muted-foreground">DURATION (S)</Label>
                              <Input
                                type="number"
                                value={editValues.duration}
                                onChange={(e) => setEditValues({ ...editValues, duration: parseInt(e.target.value) || 0 })}
                                className="h-8 text-xs border-input"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-muted-foreground">MAX REQS</Label>
                              <Input
                                type="number"
                                value={editValues.count}
                                onChange={(e) => setEditValues({ ...editValues, count: parseInt(e.target.value) || 0 })}
                                className="h-8 text-xs border-input"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[9px] font-bold text-muted-foreground">PENALTY (S)</Label>
                              <Input
                                type="number"
                                value={editValues.challenge_sec}
                                onChange={(e) => setEditValues({ ...editValues, challenge_sec: parseInt(e.target.value) || 0 })}
                                className="h-8 text-xs border-input"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[9px] font-bold text-muted-foreground">ACTION</Label>
                            <Select
                              value={editValues.action}
                              onChange={(e) => setEditValues({ ...editValues, action: e.target.value })}
                              className="h-8 text-xs"
                            >
                              <option value="block">Block</option>
                              <option value="challenge">Challenge</option>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-3">
                          <div className="flex flex-col bg-muted/50 p-2 rounded-lg">
                            <span className="text-[9px] text-muted-foreground font-bold uppercase">Window</span>
                            <span className="font-mono text-sm font-bold text-foreground mt-1">{config.duration}s</span>
                          </div>
                          <div className="flex flex-col bg-muted/50 p-2 rounded-lg">
                            <span className="text-[9px] text-muted-foreground font-bold uppercase">Threshold</span>
                            <span className="font-mono text-sm font-bold text-foreground mt-1">{config.count}</span>
                          </div>
                          <div className="flex flex-col bg-muted/50 p-2 rounded-lg">
                            <span className="text-[9px] text-muted-foreground font-bold uppercase">Penalty</span>
                            <span className="font-mono text-sm font-bold text-foreground mt-1">{config.challenge_sec}s</span>
                          </div>
                          <div className="flex flex-col bg-muted/50 p-2 rounded-lg">
                            <span className="text-[9px] text-muted-foreground font-bold uppercase">Action</span>
                            <Badge className={`mt-1 px-2 py-0.5 text-[9px] font-bold border-none shadow-none w-fit ${config.action === 'block' ? 'action-block' : 'action-challenge'}`}>
                              {(config.action || 'block').toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      )}

                      {/* Action & Response */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase">Events:</span>
                            <span className="font-mono text-xs font-bold text-foreground">
                              {statsData ? (statsData[type] ?? 0).toLocaleString() : '—'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => saveEdit(type)}
                                className="h-8 w-8 hover:bg-muted"
                              >
                                <Check className="w-4 h-4 text-muted-foreground" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={cancelEdit}
                                className="h-8 w-8 hover:bg-muted"
                              >
                                <X className="w-4 h-4 text-muted-foreground" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEdit(type)}
                              className="h-8 w-8 hover:bg-muted"
                            >
                              <SquarePen className="w-4 h-4 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
