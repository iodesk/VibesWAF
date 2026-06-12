import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure global WAF settings</p>
      </div>

      {/* Challenge Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Challenge Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-border">
              <div>
                <p className="text-sm font-medium">Challenge TTL</p>
                <p className="text-xs text-muted-foreground">Time to live for challenge tokens</p>
              </div>
              <span className="text-sm font-mono">300s</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">Challenge Wait Time</p>
                <p className="text-xs text-muted-foreground">Minimum wait time before solving</p>
              </div>
              <span className="text-sm font-mono">5s</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Whitelist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">IP Whitelist</CardTitle>
            <Button size="sm" variant="outline">Add IP</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No whitelisted IPs</p>
          </div>
        </CardContent>
      </Card>

      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">API Keys</CardTitle>
            <Button size="sm" variant="outline">Generate Key</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">No API keys configured</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
