import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApps, useDeleteApp, useToggleUnderAttackMode } from '@/hooks/useApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { Plus, Trash2, SquarePen, Globe, Server, ArrowRightLeft, Shield, RefreshCw } from 'lucide-react'
import type { App } from '@/lib/api-client'

function HealthBadge({ app }: { app: App }) {
  if (!app.config.health_check?.enabled) return null
  const total = app.config.upstreams?.filter(u => u.enabled).length || 0
  const unhealthy = app.config.upstreams?.filter(u => u.enabled && u.healthy === false).length || 0
  const allUp = unhealthy === 0
  return (
    <Badge variant="secondary" className={`border-none text-[10px] font-bold flex items-center gap-1 ${allUp ? 'text-emerald-600 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
      <RefreshCw className="w-2.5 h-2.5" />
      {allUp ? `HEALTH ${total}/${total}` : `HEALTH ${total - unhealthy}/${total}`}
    </Badge>
  )
}

export default function Applications() {
  const { data: apps, isLoading } = useApps()
  const deleteApp = useDeleteApp()
  const toggleUnderAttack = useToggleUnderAttackMode()
  const { addToast } = useToast()
  const navigate = useNavigate()

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<App | null>(null)

  const handleToggleUnderAttack = (appId: string, enabled: boolean) => {
    toggleUnderAttack.mutate({ appId, enabled }, {
      onSuccess: (data: any) => {
        // Display message from backend
        if (data?.message) {
          addToast(data.message, 'success')
        }
      },
      onError: (error: any) => {
        addToast(error?.message || 'Failed to toggle mode', 'error')
      },
    })
  }

  const handleDeleteConfirm = () => {
    if (!selectedApp) return
    deleteApp.mutate(selectedApp.id, {
      onSuccess: () => {
        setIsDeleteOpen(false)
        setSelectedApp(null)
      },
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse"></div>
          <div className="h-4 w-64 bg-muted/50 rounded animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="border border-border rounded-lg p-4 space-y-4">
              <div className="h-6 w-3/4 bg-muted rounded animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-8 w-full bg-muted/50 rounded animate-pulse"></div>
                <div className="h-8 w-full bg-muted/50 rounded animate-pulse"></div>
              </div>
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage protected applications and origin upstreams</p>
        </div>
        <Button size="sm" onClick={() => navigate('/applications/create')} className="shadow-none w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Application
        </Button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {apps && apps.length > 0 ? (
          apps.map((app) => (
            <Card key={app.id} className="hover:shadow-md transition-shadow flex flex-col border-border">
              <CardHeader className="pb-3 flex-none border-b border-border/50 bg-muted/20">
                <div className="flex items-start justify-between">
                  <div className="flex-1 truncate pr-2">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 icon-primary" />
                      <CardTitle className="text-base font-bold text-foreground truncate" title={app.domain}>{app.domain}</CardTitle>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 font-mono truncate" title={app.id}>{app.id}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 h-8 w-8 text-muted-foreground hover:text-red-600"
                    onClick={() => {
                      setSelectedApp(app)
                      setIsDeleteOpen(true)
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col pt-4">
                {/* Upstream Info */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <Server className="w-3.5 h-3.5 icon-neutral mt-0.5" />
                    <div className="flex flex-col gap-1.5 flex-1">
                      {app.config.upstreams?.slice(0, 2).map((u, i) => {
                        const hcEnabled = app.config.health_check?.enabled
                        const isHealthy = !hcEnabled || u.healthy !== false
                        return (
                          <div key={i} className="flex items-center justify-between bg-muted/50 px-2 py-1 rounded border border-border">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {hcEnabled && (
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              )}
                              <span className="text-[10px] font-mono text-foreground truncate">{u.scheme}://{u.host}:{u.port}</span>
                            </div>
                            {i === 0 && app.config.upstreams.length > 2 && (
                              <span className="text-[9px] font-bold text-muted-foreground shrink-0">+{app.config.upstreams.length - 1} more</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  
                  {app.config.upstreams?.length > 1 && (
                    <div className="flex items-center gap-2 px-1">
                      <ArrowRightLeft className="w-3.5 h-3.5 icon-info" />
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">LB: {app.config.lb_method?.replace('-', ' ')}</span>
                    </div>
                  )}
                </div>

                {/* Under Attack Mode Toggle */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded border border-border">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 icon-warning" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Under Attack Mode</p>
                      <p className="text-[10px] text-muted-foreground">Force challenge all visitors</p>
                    </div>
                  </div>
                  <Switch
                    checked={app.under_attack_mode}
                    onCheckedChange={(checked) => handleToggleUnderAttack(app.id, checked)}
                    className="data-[state=checked]:btn-primary"
                  />
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <HealthBadge app={app} />
                  {app.under_attack_mode && (
                    <Badge className="action-block border-none text-[10px] font-bold animate-pulse">
                      🛡️ UNDER ATTACK
                    </Badge>
                  )}
                  <Badge variant="secondary" className="action-log hover:action-log border-none text-[10px] font-bold">
                    WAF {app.config?.use_global_waf ? 'GLOBAL' : 'CUSTOM'}
                  </Badge>
                  <Badge variant="secondary" className="action-log hover:action-log border-none text-[10px] font-bold">
                    BOT {app.config?.use_global_bot ? 'GLOBAL' : 'CUSTOM'}
                  </Badge>
                  <Badge variant="secondary" className="action-log hover:action-log border-none text-[10px] font-bold">
                    LIMIT {app.config?.use_global_rate_limit ? 'GLOBAL' : 'CUSTOM'}
                  </Badge>
                </div>
                
                {/* Actions */}
                <div className="mt-auto pt-4">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full border-border text-foreground font-bold text-xs" 
                    onClick={() => navigate(`/applications/edit/${app.id}`)}
                  >
                    <SquarePen className="w-3.5 h-3.5 mr-2" />
                    Edit Application
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full border-dashed border-2 border-border shadow-none">
            <CardContent className="text-center py-16">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-6 h-6 icon-neutral" />
              </div>
              <p className="text-sm font-medium text-foreground mb-4">No applications configured yet</p>
              <Button size="sm" onClick={() => navigate('/applications/create')} className="shadow-none">
                <Plus className="w-4 h-4 mr-2" /> Add Your First Application
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Delete Application</DialogTitle>
            <DialogDescription className="text-sm">
              Are you sure you want to delete <span className="font-bold text-foreground">{selectedApp?.domain}</span>? This action cannot be undone and will stop protection for this domain.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} className="shadow-none">Delete Application</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

