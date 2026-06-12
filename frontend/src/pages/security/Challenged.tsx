import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useBotConfig, useUpdateBotConfig, useLogs, useChallengeStats } from '@/hooks/useApi'
import { useToast } from '@/components/ui/toast'
import { 
  Shield, 
  Eye, 
  Save, 
  Laptop, 
  Smartphone, 
  BarChart3, 
  Settings2, 
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'

export default function Challenged() {
  const [activeTab, setActiveTab] = useState<'appearance' | 'analytics'>('appearance')
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [timeRange, setTimeRange] = useState<'1d' | '7d' | '30d'>(() => {
    const saved = localStorage.getItem('challenged-time-range')
    return (saved === '1d' || saved === '7d' || saved === '30d') ? saved : '7d'
  })
  const [logSearchTerm, setLogSearchTerm] = useState('')
  const [logPage, setLogPage] = useState(1)
  const logsPerPage = 50
  
  const { data: botConfig, isLoading: isConfigLoading } = useBotConfig()
  const updateBotConfig = useUpdateBotConfig()
  const { addToast } = useToast()

  const handleTimeRangeChange = (range: '1d' | '7d' | '30d') => {
    setTimeRange(range)
    localStorage.setItem('challenged-time-range', range)
  }

  // Analytics State
  const { data: logsResponse, isLoading: isLogsLoading } = useLogs({ 
    days: timeRange === '1d' ? 1 : timeRange === '7d' ? 7 : 30,
    limit: timeRange === '1d' ? 1000 : timeRange === '7d' ? 5000 : 10000
  })
  
  // Extract logs from response
  const logs = logsResponse?.data || []
  const challengeLogs = useMemo(() => logs?.filter(l => 
    l.action === 'challenge' || l.action === 'challenge_solved' || l.action === 'challenge_failed'
  ) || [], [logs])
  
  const { data: challengeStatsData } = useChallengeStats(timeRange)
  const stats = challengeStatsData || { total: 0, solved: 0, failed: 0, issued: 0, rate: 0 }

  const filteredLogs = useMemo(() => {
    if (!logSearchTerm) return challengeLogs
    const term = logSearchTerm.toLowerCase()
    return challengeLogs.filter(log =>
      log.ip.toLowerCase().includes(term) ||
      log.host.toLowerCase().includes(term) ||
      (log.ua && log.ua.toLowerCase().includes(term))
    )
  }, [challengeLogs, logSearchTerm])

  const totalLogPages = Math.max(1, Math.ceil(filteredLogs.length / logsPerPage))
  const paginatedLogs = useMemo(() => {
    const start = (logPage - 1) * logsPerPage
    return filteredLogs.slice(start, start + logsPerPage)
  }, [filteredLogs, logPage, logsPerPage])

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    footer: '',
    show_ray_id: true,
    custom_html: '',
    mode: 'basic',
    challenge_duration: 36000,
    challenge_wait: 3,
    max_attempts: 3,
    trust_levels: {
      level0_max: 0.40,
      level1_max: 0.60,
      level2_max: 0.80,
      reductions: [0, -5, -10, -15] as [number, number, number, number]
    }
  })

  useEffect(() => {
    if (botConfig) {
      setFormData({
        title: botConfig.challenge.title || 'Verifying your connection...',
        description: botConfig.challenge.description || 'Please wait while we verify your request.',
        footer: botConfig.challenge.footer || 'Protected by Vibes WAF',
        show_ray_id: botConfig.challenge.show_ray_id ?? true,
        custom_html: botConfig.challenge.custom_html || '',
        mode: botConfig.challenge.custom_html ? 'custom' : 'basic',
        challenge_duration: botConfig.challenge_duration || 36000,
        challenge_wait: botConfig.challenge_wait || 3,
        max_attempts: (botConfig as any).max_attempts || 3,
        trust_levels: botConfig.trust_levels || {
          level0_max: 0.40,
          level1_max: 0.60,
          level2_max: 0.80,
          reductions: [0, -5, -10, -15]
        }
      })
    }
  }, [botConfig])

  const handleSave = async () => {
    if (!botConfig) return
    try {
      await updateBotConfig.mutateAsync({
        ...botConfig,
        challenge: {
          title: formData.title,
          description: formData.description,
          footer: formData.footer,
          show_ray_id: formData.show_ray_id,
          custom_html: formData.mode === 'custom' ? formData.custom_html : ''
        },
        challenge_duration: formData.challenge_duration,
        challenge_wait: formData.challenge_wait,
        trust_levels: formData.trust_levels
      })
      addToast('Challenge settings updated', 'success')
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to update settings'
      addToast(errorMessage, 'error')
    }
  }

  if (isConfigLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col gap-4 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Challenge Page</h1>
            <p className="text-sm text-muted-foreground mt-1">Customize the experience for users being verified</p>
          </div>
          
          {activeTab === 'appearance' && (
            <Button onClick={handleSave} className="btn-primary hover:opacity-90 shadow-none w-full sm:w-auto sm:flex-shrink-0">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          )}
        </div>
        
        {/* Tabs */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button 
            onClick={() => setActiveTab('appearance')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'appearance' 
                ? 'btn-primary hover:opacity-90 shadow-none text-white' 
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5" />
              Appearance
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'analytics' 
                ? 'btn-primary hover:opacity-90 shadow-none text-white' 
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />
              Analytics & Logs
            </div>
          </button>
        </div>
      </div>

      {activeTab === 'appearance' ? (
        <div className="space-y-8">
          {/* Settings Row: Appearance + Trust Levels side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Appearance Settings */}
            <Card className="shadow-none border-border">
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Appearance</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Page Title</Label>
                  <Input 
                    value={formData.title} 
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Checking your browser..."
                    className="bg-muted/50 border-input focus:bg-background"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Description</Label>
                  <Textarea 
                    value={formData.description} 
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Please wait while we verify your request."
                    className="bg-muted/50 border-input focus:bg-background min-h-[80px] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground uppercase tracking-wider">Footer Text</Label>
                  <Input 
                    value={formData.footer} 
                    onChange={(e) => setFormData({ ...formData, footer: e.target.value })}
                    placeholder="Security by Wafer"
                    className="bg-muted/50 border-input focus:bg-background"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold text-foreground">Show Ray ID</Label>
                    <p className="text-[10px] text-muted-foreground">Unique identifier for troubleshooting</p>
                  </div>
                  <Switch 
                    checked={formData.show_ray_id}
                    onCheckedChange={(v) => setFormData({ ...formData, show_ray_id: v })}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border/50">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Expiry (sec)</Label>
                    <Input 
                      type="number" 
                      value={formData.challenge_duration}
                      onChange={(e) => setFormData({ ...formData, challenge_duration: parseInt(e.target.value) || 0 })}
                      className="h-8 text-xs border-input"
                    />
                    <p className="text-[9px] text-muted-foreground">Verified session</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Timeout (sec)</Label>
                    <Input 
                      type="number" 
                      value={formData.challenge_wait}
                      onChange={(e) => setFormData({ ...formData, challenge_wait: parseInt(e.target.value) || 0 })}
                      className="h-8 text-xs border-input"
                    />
                    <p className="text-[9px] text-muted-foreground">Challenge expires</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase">Max Attempts</Label>
                    <Input 
                      type="number" 
                      value={formData.max_attempts}
                      onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 3 })}
                      className="h-8 text-xs border-input"
                    />
                    <p className="text-[9px] text-muted-foreground">Retries before refresh</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trust Levels */}
            <Card className="shadow-none border-border">
              <CardHeader className="pb-4 border-b border-border/50 bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-semibold">Trust Levels</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-bold">BEHAVIOR</Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  After solving, behavior analysis determines trust level. Higher levels get more score reduction.
                </p>

                <div className="space-y-2.5">
                  {[
                    { level: 0, label: 'Level 0', desc: 'Solved but suspicious', color: 'text-red-500' },
                    { level: 1, label: 'Level 1', desc: 'Basic verification', color: 'text-amber-500' },
                    { level: 2, label: 'Level 2', desc: 'Natural interaction', color: 'text-blue-500' },
                    { level: 3, label: 'Level 3', desc: 'High confidence human', color: 'text-green-500' },
                  ].map((item) => (
                    <div key={item.level} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg border border-border/50">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-xs font-bold ${item.color}`}>{item.label}</span>
                        <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                      </div>
                      <Input
                        type="number"
                        value={formData.trust_levels.reductions[item.level]}
                        onChange={(e) => {
                          const newReductions = [...formData.trust_levels.reductions] as [number, number, number, number]
                          newReductions[item.level] = parseInt(e.target.value) || 0
                          setFormData({ ...formData, trust_levels: { ...formData.trust_levels, reductions: newReductions } })
                        }}
                        className="h-7 w-16 text-xs text-center border-input"
                      />
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-border/50 space-y-2.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase">Confidence Boundaries</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">L0 → L1</Label>
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={formData.trust_levels.level0_max}
                        onChange={(e) => setFormData({ ...formData, trust_levels: { ...formData.trust_levels, level0_max: parseFloat(e.target.value) || 0 } })}
                        className="h-7 text-xs border-input"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">L1 → L2</Label>
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={formData.trust_levels.level1_max}
                        onChange={(e) => setFormData({ ...formData, trust_levels: { ...formData.trust_levels, level1_max: parseFloat(e.target.value) || 0 } })}
                        className="h-7 text-xs border-input"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[9px] text-muted-foreground">L2 → L3</Label>
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={formData.trust_levels.level2_max}
                        onChange={(e) => setFormData({ ...formData, trust_levels: { ...formData.trust_levels, level2_max: parseFloat(e.target.value) || 0 } })}
                        className="h-7 text-xs border-input"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Preview — Full Width Below */}
          <Card className="shadow-none border-border">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-semibold">Live Preview</CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setPreviewDevice('desktop')}
                    className={`h-8 w-8 ${previewDevice === 'desktop' ? 'btn-primary hover:opacity-90 shadow-none' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  >
                    <Laptop className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setPreviewDevice('mobile')}
                    className={`h-8 w-8 ${previewDevice === 'mobile' ? 'btn-primary hover:opacity-90 shadow-none' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 flex justify-center">
              <div className={`transition-all duration-500 ease-in-out overflow-hidden relative shadow-2xl ${
                previewDevice === 'desktop' 
                  ? 'w-full max-w-[900px] aspect-[16/10] border-4 border-foreground rounded-xl' 
                  : 'w-[320px] aspect-[9/18] border-[8px] border-foreground rounded-[40px]'
              } bg-muted`}>
                {/* Mock Browser/Device Header */}
                {previewDevice === 'desktop' ? (
                  <div className="h-8 bg-slate-800 flex items-center px-4 gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <div className="flex-1 mx-4 h-5 bg-slate-700 rounded text-[9px] flex items-center px-3 text-slate-400 truncate">
                      https://vibes-protected-site.com
                    </div>
                  </div>
                ) : (
                  <div className="h-12 bg-slate-800 flex items-center justify-center relative">
                    <div className="w-20 h-4 bg-slate-900 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-slate-700" />
                  </div>
                )}

                {/* Preview Content — matches challenge.html layout */}
                <div className={`absolute inset-0 ${previewDevice === 'desktop' ? 'top-8' : 'top-12'} bg-[#0a0a0a] grid`} style={{ gridTemplateRows: 'auto 1fr auto' }}>
                  {/* Header */}
                  <div className="flex items-center justify-between px-8 py-4 border-b border-[#1f1f1f]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#2563eb] flex items-center justify-center flex-shrink-0">
                        <Shield className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[11px] font-semibold text-white">Vibes WAF</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#1a1a2e] bg-[#0a0a1a]">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#ca8a04] animate-pulse" />
                      <span className="text-[9px] font-medium text-[#ca8a04] uppercase tracking-wide">Verifying</span>
                    </div>
                  </div>

                  {/* Main — vertically centered, left-aligned content with max-width */}
                  <div className="flex items-center px-8">
                    <div className="w-full" style={{ maxWidth: '420px' }}>
                      <p className="text-[9px] font-semibold text-[#525252] uppercase tracking-widest mb-4">Security Check</p>
                      <h2 className={`font-bold text-white mb-2 leading-tight tracking-tight ${previewDevice === 'desktop' ? 'text-2xl' : 'text-lg'}`}>
                        {formData.title || 'Verify you are human'}
                      </h2>
                      <p className="text-[11px] text-[#737373] mb-5 leading-relaxed" style={{ maxWidth: '340px' }}>
                        {formData.description || 'Slide the handle to the highlighted zone to prove you are not bot.'}
                      </p>

                      {/* Slider Box */}
                      <div className="p-3.5 border border-[#1f1f1f] bg-[#111] rounded-md mb-5">
                        <p className="text-[8px] font-semibold text-[#525252] uppercase tracking-wider mb-2.5">Drag to the target zone</p>
                        <div className="relative w-full h-[30px] rounded bg-[#0a0a0a] border border-[#2a2a2a] overflow-hidden">
                          <div className="absolute top-0 h-full w-[8%] left-[55%] bg-[rgba(37,99,235,0.08)] border-l-2 border-r-2 border-[rgba(37,99,235,0.3)]" />
                          <div className="absolute top-[1px] left-[2px] w-[28px] h-[28px] bg-[#2563eb] rounded flex items-center justify-center">
                            <ChevronRight className="w-3 h-3 text-white" />
                          </div>
                        </div>
                        <p className="text-[9px] text-[#525252] mt-2.5 font-medium">Waiting for interaction...</p>
                      </div>

                      {/* Divider + Meta */}
                      <div className="w-full h-px bg-[#1f1f1f] mb-4" />
                      <div className="flex items-start gap-8">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-semibold text-[#404040] uppercase tracking-wider">Host</span>
                          <span className="text-[11px] text-[#737373] font-mono">example.com</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-semibold text-[#404040] uppercase tracking-wider">Challenge</span>
                          <span className="text-[11px] text-[#737373] font-mono">Slider</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-semibold text-[#404040] uppercase tracking-wider">Status</span>
                          <span className="text-[11px] text-[#737373] font-mono">Pending</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between px-8 py-3.5 border-t border-[#1f1f1f]">
                    <span className="text-[10px] text-[#404040]"></span>
                    <span className="text-[10px] text-[#404040]">Protected by <span className="text-[#737373]">{formData.footer || 'Vibes WAF'}</span></span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Time Range Filter */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Challenge Analytics</h2>
              <p className="text-xs text-muted-foreground mt-1">
                {timeRange === '1d' ? 'Last 24 hours' :
                 timeRange === '7d' ? 'Last 7 days' :
                 'Last 30 days'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleTimeRangeChange('1d')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  timeRange === '1d'
                    ? 'btn-primary hover:opacity-90 shadow-none text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                1D
              </button>
              <button
                onClick={() => handleTimeRangeChange('7d')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  timeRange === '7d'
                    ? 'btn-primary hover:opacity-90 shadow-none text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                7D
              </button>
              <button
                onClick={() => handleTimeRangeChange('30d')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  timeRange === '30d'
                    ? 'btn-primary hover:opacity-90 shadow-none text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                30D
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="shadow-none border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Challenges Issued</p>
                  <Activity className="w-4 h-4 icon-primary" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-bold text-foreground">{stats.total}</span>
                  <span className="text-[11px] text-muted-foreground mb-1">Total Logs</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Solved (Est.)</p>
                  <CheckCircle2 className="w-4 h-4 icon-success" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-bold text-foreground">{stats.solved}</span>
                  <span className="text-[11px] text-muted-foreground mb-1 font-medium">{typeof stats.rate === 'number' ? stats.rate.toFixed(1) : stats.rate}% Rate</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bounced / Failed</p>
                  <XCircle className="w-4 h-4 icon-danger" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-bold text-foreground">{stats.failed}</span>
                  <span className="text-[11px] text-muted-foreground mb-1">Dropped Requests</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Avg. Solve Time</p>
                  <Clock className="w-4 h-4 icon-warning" />
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-xl font-bold text-foreground">3.4</span>
                  <span className="text-[11px] text-muted-foreground mb-1">Seconds</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card className="shadow-none border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-border/50 bg-muted/30">
              <div>
                <CardTitle className="text-sm font-semibold text-foreground">Challenged Requests</CardTitle>
                <CardDescription className="text-xs">Live feed of requests currently being challenged</CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Filter by IP, Host, or UA..." 
                  value={logSearchTerm}
                  onChange={(e) => { setLogSearchTerm(e.target.value); setLogPage(1) }}
                  className="h-8 pl-8 text-xs w-64 bg-background border-input"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-border/50">
                    <TableHead className="w-[180px] h-10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider pl-6">Timestamp</TableHead>
                    <TableHead className="h-10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">IP Address</TableHead>
                    <TableHead className="h-10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Target Host</TableHead>
                    <TableHead className="h-10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reason</TableHead>
                    <TableHead className="h-10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                    <TableHead className="h-10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Action</TableHead>
                    <TableHead className="h-10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider pr-6">User-Agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLogsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-muted border-t-foreground" />
                          <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase">Streaming Logs...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : paginatedLogs.length > 0 ? (
                    paginatedLogs.map((log, idx) => (
                      <TableRow key={idx} className="hover:bg-muted/30 transition-colors border-border/50 group">
                        <TableCell className="py-3 pl-6">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-medium text-foreground">{new Date(log.ts).toLocaleTimeString()}</span>
                            <span className="text-[10px] text-muted-foreground">{new Date(log.ts).toLocaleDateString()}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {log.ip}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="text-[11px] font-medium text-muted-foreground">{log.host}</span>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="bg-muted text-muted-foreground border-border font-bold text-[9px] uppercase tracking-tighter">
                            {log.reason || 'BOT_SUSPECT'}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3">
                          {log.action === 'challenge_solved' ? (
                            <div className="flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3 icon-success" />
                              <span className="text-[10px] font-bold text-green-600">Solved</span>
                            </div>
                          ) : log.action === 'challenge_failed' ? (
                            <div className="flex items-center gap-1.5">
                              <XCircle className="w-3 h-3 icon-danger" />
                              <span className="text-[10px] font-bold text-red-500">Failed</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3 icon-warning" />
                              <span className="text-[10px] font-bold text-amber-600">Issued</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge className="bg-foreground text-background border-none font-bold text-[9px] uppercase">
                            CHALLENGE
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 pr-6">
                          <div className="max-w-[180px] truncate text-[10px] text-muted-foreground italic" title={log.ua}>
                            {log.ua}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center text-muted-foreground text-xs">
                        No challenged requests found matching your filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {filteredLogs.length > 0 && (
              <div className="px-6 py-4 border-t border-border/50 bg-muted/30 flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  Showing <span className="text-foreground font-medium">{Math.min(filteredLogs.length, (logPage - 1) * logsPerPage + 1)}</span> to <span className="text-foreground font-medium">{Math.min(filteredLogs.length, logPage * logsPerPage)}</span> of <span className="text-foreground font-bold">{filteredLogs.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px] px-3 border-border"
                    disabled={logPage === 1}
                    onClick={() => setLogPage(prev => prev - 1)}
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1 px-3 h-8 bg-background border border-border rounded-md">
                    <span className="text-xs font-bold text-foreground">{logPage}</span>
                    <span className="text-xs text-muted-foreground/50">/</span>
                    <span className="text-xs font-medium text-muted-foreground">{totalLogPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-[11px] px-3 border-border"
                    disabled={logPage === totalLogPages}
                    onClick={() => setLogPage(prev => prev + 1)}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

