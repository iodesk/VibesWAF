import { lazy, Suspense, useState } from 'react'
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Globe, Gauge, Bot, Activity,
  Shield, ShieldAlert, LogOut, Menu, X, Sun, Moon,
  ChevronRight, Bell, Lock, Target, AlertTriangle, Radar, Fingerprint
} from 'lucide-react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { DemoProvider, useDemo } from './contexts/DemoContext'
import { ProtectedRoute } from './components/auth/ProtectedRoute'

const Dashboard    = lazy(() => import('./pages/dashboard/Dashboard'))
const Applications = lazy(() => import('./pages/applications/Applications'))
const AppForm      = lazy(() => import('./pages/applications/AppForm'))
const RateLimiter  = lazy(() => import('./pages/security/RateLimiter'))
const BotDetector  = lazy(() => import('./pages/security/BotDetector'))
const Challenged   = lazy(() => import('./pages/security/Challenged'))
const WAFEngine    = lazy(() => import('./pages/security/WAFEngine'))
const SSLManager   = lazy(() => import('./pages/security/SSLManager'))
const ScoringEngine = lazy(() => import('./pages/security/ScoringEngine'))
const AnomalyBehavior = lazy(() => import('./pages/security/AnomalyBehavior'))
const IPReputation = lazy(() => import('./pages/security/IPReputation'))
const Logs         = lazy(() => import('./pages/monitoring/Logs'))
const ThreatIntelligence = lazy(() => import('./pages/monitoring/ThreatIntelligence'))
const Login        = lazy(() => import('./pages/auth/Login'))
const Setup        = lazy(() => import('./pages/auth/Setup'))

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
  </div>
)

const navGroups = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard',     href: '/',            icon: LayoutDashboard },
      { name: 'Applications',  href: '/applications', icon: Globe },
      { name: 'SSL Manager',     href: '/ssl-manager',        icon: Lock },      
    ],
  },
  {
    label: 'Security',
    items: [
      { name: 'WAF Settings',    href: '/waf-engine',         icon: ShieldAlert },
      { name: 'Rate Limiter',    href: '/rate-limiter',       icon: Gauge },
      { name: 'Bot Detector',    href: '/bot-detector',       icon: Bot },
      { name: 'IP Reputation',   href: '/ip-reputation',      icon: Fingerprint },
      { name: 'Anomaly Behavior', href: '/anomaly-behavior',   icon: AlertTriangle },
      { name: 'Scoring Engine',  href: '/scoring-engine',     icon: Target },
      { name: 'Challenge Page',  href: '/security/challenged', icon: Shield },
    ],
  },
  {
    label: 'Monitoring',
    items: [
      { name: 'Logs',               href: '/logs',               icon: Activity },
      { name: 'Threat Intelligence', href: '/threat-intelligence', icon: Radar },
    ],
  },
]

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="p-1.5 rounded transition-colors text-[hsl(var(--color-sidebar-foreground))] sidebar-hover hover:text-[hsl(var(--color-sidebar-text))]"
    >
      {theme === 'light'
        ? <Sun size={15} />
        : <Moon size={15} />
      }
    </button>
  )
}

function Sidebar({ onClose }: { onClose?: () => void }) {
  const location = useLocation()
  const { logout } = useAuth()

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--color-sidebar))]">

      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b sidebar-border shrink-0">
        <div className="w-7 h-7 rounded-lg btn-primary flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-semibold text-[13px] text-[hsl(var(--color-sidebar-text))] tracking-tight">VibesWAF</span>
          <span className="text-[10px] text-[hsl(var(--color-sidebar-foreground))]">WAF Platform</span>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--color-sidebar-foreground))] opacity-60 select-none">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-2.5 py-2 text-[15px] rounded-md transition-all ${
                      isActive
                        ? 'bg-primary/20 text-[hsl(var(--color-sidebar-active))] font-medium'
                        : 'text-[hsl(var(--color-sidebar-foreground))] sidebar-hover hover:text-[hsl(var(--color-sidebar-text))]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[hsl(var(--color-sidebar-active))]' : ''}`} />
                    <span>{item.name}</span>
                    {isActive && <ChevronRight className="ml-auto w-3 h-3 text-[hsl(var(--color-sidebar-active))]" />}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="px-3 py-3 border-t sidebar-border shrink-0">
        <button
          onClick={logout}
          className="flex items-center gap-2.5 w-full px-2.5 py-2 text-[12px] rounded-md transition-colors text-[hsl(var(--color-sidebar-foreground))] sidebar-hover hover:text-[hsl(var(--color-sidebar-text))]"
        >
          <LogOut className="w-3.5 h-3.5 shrink-0" />
          <span>Sign out</span>
        </button>
        <div className="px-2.5 pt-2">
          <span className="text-[13px] text-[hsl(var(--color-sidebar-foreground))] opacity-50">v1.0.0</span>
        </div>
      </div>
    </div>
  )
}

function PageHeader() {
  const location = useLocation()
  const { user } = useAuth()
  const { isDemoMode } = useDemo()

  const allItems = navGroups.flatMap(g => g.items)
  const current = allItems.find(i => i.href === location.pathname)
  const pageTitle = current?.name ?? 'Dashboard'

  return (
    <header className="border-b border-border bg-card/95 backdrop-blur-sm shrink-0">
      {isDemoMode && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-1.5 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Demo Mode</span>
          <span className="text-[11px] text-amber-600/80 dark:text-amber-400/80">Global config is read-only. Per-app settings are fully editable.</span>
        </div>
      )}
      <div className="h-14 flex items-center px-6 gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-[14px] font-semibold text-foreground truncate">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggleButton />
          <button
            aria-label="Notifications"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Bell className="w-4 h-4" />
          </button>
          {user && (
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <div className="w-7 h-7 rounded-full btn-primary/10 flex items-center justify-center">
                <span className="text-[11px] font-bold text-primary uppercase">
                  {user.username.charAt(0)}
                </span>
              </div>
              <span className="text-[12px] font-medium text-foreground hidden sm:block">{user.username}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function AppContent() {
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { needsSetup, checkAuth } = useAuth()

  if (needsSetup) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Setup onComplete={() => checkAuth()} />
      </Suspense>
    )
  }

  if (location.pathname === '/login') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    )
  }

  return (
    <div className="flex min-h-screen bg-background w-full">

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-[hsl(var(--color-sidebar))] border-b sidebar-border flex items-center px-4 gap-3">
        <div className="w-7 h-7 rounded-lg btn-primary flex items-center justify-center shrink-0">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <span className="font-semibold text-[13px] text-[hsl(var(--color-sidebar-text))]">VibesWAF</span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggleButton />
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-md transition-colors text-[hsl(var(--color-sidebar-foreground))] sidebar-hover hover:text-[hsl(var(--color-sidebar-text))]"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 z-50 border-r sidebar-border transition-transform duration-200 ease-in-out ${
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </aside>

      {/* Main column */}
      <div className="flex-1 lg:ml-64 flex flex-col h-screen pt-14 lg:pt-0 w-full min-w-0 overflow-y-auto">
        <div className="hidden lg:block sticky top-0 z-30">
          <PageHeader />
        </div>
        <main className="flex-1 min-w-0 w-full max-w-[1400px] mx-auto py-4 sm:py-6 px-4 sm:px-[6%] lg:px-[8%]">
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/"                        element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/applications"            element={<ProtectedRoute><Applications /></ProtectedRoute>} />
              <Route path="/applications/create"     element={<ProtectedRoute><AppForm /></ProtectedRoute>} />
              <Route path="/applications/edit/:id"   element={<ProtectedRoute><AppForm /></ProtectedRoute>} />
              <Route path="/rules-engine"            element={<Navigate to="/applications" replace />} />
              <Route path="/rules-engine/create"     element={<Navigate to="/applications" replace />} />
              <Route path="/rules-engine/edit/:id"   element={<Navigate to="/applications" replace />} />
              <Route path="/rate-limiter"            element={<ProtectedRoute><RateLimiter /></ProtectedRoute>} />
              <Route path="/bot-detector"            element={<ProtectedRoute><BotDetector /></ProtectedRoute>} />
              <Route path="/waf-engine"              element={<ProtectedRoute><WAFEngine /></ProtectedRoute>} />
              <Route path="/ssl-manager"             element={<ProtectedRoute><SSLManager /></ProtectedRoute>} />
              <Route path="/scoring-engine"          element={<ProtectedRoute><ScoringEngine /></ProtectedRoute>} />
              <Route path="/ip-reputation"           element={<ProtectedRoute><IPReputation /></ProtectedRoute>} />
              <Route path="/anomaly-behavior"        element={<ProtectedRoute><AnomalyBehavior /></ProtectedRoute>} />
              <Route path="/security/challenged"     element={<ProtectedRoute><Challenged /></ProtectedRoute>} />
              <Route path="/logs"                    element={<ProtectedRoute><Logs /></ProtectedRoute>} />
              <Route path="/threat-intelligence"    element={<ProtectedRoute><ThreatIntelligence /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <DemoProvider>
          <AppContent />
        </DemoProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App

