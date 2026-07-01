import React, { useState } from 'react'
import { Shield, AlertCircle, CheckCircle2 } from 'lucide-react'
import { apiBase } from '@/lib/api-client'

interface SetupProps {
  onComplete: () => void
}

export default function Setup({ onComplete }: SetupProps) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${apiBase}/api/v1/auth/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password, email }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Setup failed')
      }

      setSuccess(true)
      setTimeout(() => onComplete(), 1500)
    } catch (err: any) {
      setError(err.message || 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="hidden lg:flex lg:w-[420px] bg-[hsl(var(--color-sidebar))] flex-col justify-between p-10 shrink-0 min-h-screen">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md btn-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white text-sm">VibesWAF</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-white leading-snug mb-3">
            Initial Setup
          </p>
          <p className="text-sm text-[hsl(var(--color-sidebar-foreground))] leading-relaxed">
            A reverse proxy and WAF for personal use and experimentation.
          </p>
        </div>
        <p className="text-[11px] text-[hsl(var(--color-sidebar-foreground))]">v1.0.0 · Personal project</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-[400px]">
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-md btn-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-foreground">VibesWAF</span>
          </div>

          <div className="mb-6">
            <h1 className="text-lg font-bold text-foreground">Create Admin Account</h1>
            <p className="text-xs text-muted-foreground mt-1">Set up your first administrator account</p>
          </div>

          {success && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <p className="text-xs text-green-500">Setup complete. Redirecting to login...</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label htmlFor="username" className="block text-xs font-medium text-foreground">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full h-9 px-3 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                placeholder="admin"
                disabled={loading || success}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-foreground">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-9 px-3 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                placeholder="admin@example.com"
                disabled={loading || success}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-medium text-foreground">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-9 px-3 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                placeholder="••••••••"
                disabled={loading || success}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-xs font-medium text-foreground">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full h-9 px-3 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                placeholder="••••••••"
                disabled={loading || success}
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full h-9 btn-primary hover:opacity-90 text-white text-sm font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  Creating...
                </span>
              ) : 'Create Admin Account'}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            This can only be done once
          </p>
        </div>
      </div>
    </div>
  )
}
