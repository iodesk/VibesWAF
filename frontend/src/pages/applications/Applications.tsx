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
    <Badge variant={allUp ? 'outline' : 'destructive'} className="text-[10px] font-bold">
      <RefreshCw className={`w-3 h-3 mr-1 ${allUp ? '' : 'animate-spin'}`} />
      {allUp ? `${total}/${total} Healthy` : `${total - unhealthy}/${total} Healthy`}
    </Badge>
  )
}

export default function Applications() {
  const navigate = useNavigate()
  const { data: apps, isLoading, error } = useApps()
  const deleteApp = useDeleteApp()
  const toggleUnderAttack = useToggleUnderAttackMode()
  const { addToast } = useToast()

  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<App | null>(null)

  const handleDelete = (app: App) => {
    setSelectedApp(app)
    setIsDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!selectedApp) return
    try {
      await deleteApp.mutateAsync(selectedApp.id)
      addToast('Application deleted', 'success')
      setIsDeleteOpen(false)
    } catch {
      addToast('Failed to delete application', 'error')
    }
  }

  const handleToggleAttack = async (app: App, enabled: boolean) => {
    try {
      await toggleUnderAttack.mutateAsync({ appId: app.id, enabled })
      addToast(enabled ? 'Under Attack mode enabled' : 'Under Attack mode disabled', 'success')
    } catch {
      addToast('Failed to toggle Under Attack mode', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">Loading applications...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500 text-sm">Failed to load applications.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Applications</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage protected domains and upstream servers.</p>
        </div>
        <Button onClick={() => navigate('/applications/create')} className="shadow-none">
          <Plus className="w-4 h-4 mr-2" /> Add Application
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps && apps.length > 0 ? (
          apps.map((app) => (
            <Card key={app.id} className="shadow-none border-border hover:border-primary/30 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    {app.domain}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                  <Server className="w-3 h-3" />
                  <span>{app.config.upstreams?.length || 0} upstream(s)</span>
                  <ArrowRightLeft className="w-3 h-3 ml-1" />
                  <span>{app.config.lb_method}</span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {/* Badges */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <HealthBadge app={app} />
                  {app.under_attack_mode && (
                    <Badge className="action-block border-none text-[10px] font-bold animate-pulse">
                      {'\u{1F6E1}\uFE0F'} UNDER ATTACK
                    </Badge>
                  )}
                </div>

                {/* Under Attack toggle */}
                <div className="flex items-center justify-between py-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground font-medium">Under Attack Mode</span>
                  </div>
                  <Switch
                    checked={app.under_attack_mode}
                    onCheckedChange={(checked) => handleToggleAttack(app, checked)}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-border text-foreground font-bold text-xs"
                    onClick={() => navigate(`/applications/edit/${app.id}`)}
                  >
                    <SquarePen className="w-3.5 h-3.5 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border text-red-500 hover:text-red-600 font-bold text-xs"
                    onClick={() => handleDelete(app)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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