import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Shield, AlertCircle } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[420px] bg-[hsl(var(--color-sidebar))] flex-col justify-between p-10 shrink-0 min-h-screen">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md btn-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm">VibesWAF</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-white leading-snug mb-3">
            VibesWAF
          </p>
          <p className="text-sm text-[hsl(var(--color-sidebar-foreground))] leading-relaxed">
            A reverse proxy and WAF for personal use and experimentation.
          </p>
        </div>
        <p className="text-[11px] text-[hsl(var(--color-sidebar-foreground))]">v1.0.0 · Personal project</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-[400px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-md btn-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground">VibesWAF</span>
          </div>

          <div className="mb-6">
            <h1 className="text-lg font-bold text-foreground">Sign in</h1>
            <p className="text-xs text-muted-foreground mt-1">Enter your credentials</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-xs font-medium text-foreground">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full h-9 px-3 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                placeholder="admin"
                disabled={loading}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-9 px-3 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 btn-primary hover:opacity-90 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            Protected by VibesWAF
          </p>
        </div>
      </div>
    </div>
  )
}

