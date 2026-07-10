import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'
import { useAuth } from '../lib/auth-context'

export function LoginPage(): JSX.Element {
  const navigate = useNavigate()
  const { session, isAdmin, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const existingEmail = session?.user.email ?? null
  const [pendingRedirect, setPendingRedirect] = useState(false)

  // Navigate once AuthContext has fully resolved entitlements after sign-in.
  useEffect(() => {
    if (pendingRedirect && !loading) {
      navigate(isAdmin ? '/admin' : '/play', { replace: true })
    }
  }, [pendingRedirect, loading, isAdmin, navigate])

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const { error: signInError } = await supabaseProd.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setSubmitting(false)
      setError(signInError.message)
      return
    }

    // Don't navigate immediately, wait for AuthContext to resolve isAdmin
    // so RequireAuth doesn't bounce admins back to /play.
    setPendingRedirect(true)
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gold flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-on-gold">B</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-ink">Beat Small Stakes</h1>
            <p className="text-sm text-ink-3 mt-0.5">Sign in to your account</p>
          </div>
        </div>

        {/* Already-signed-in banner */}
        {!loading && existingEmail && (
          <div className="card flex items-center justify-between gap-3">
            <p className="text-sm text-ink-2 truncate">
              Signed in as <span className="text-ink font-medium">{existingEmail}</span>
            </p>
            <Link
              to={isAdmin ? '/admin' : '/play'}
              className="text-sm text-gold hover:text-gold font-medium whitespace-nowrap transition-colors"
            >
              Continue →
            </Link>
          </div>
        )}

        {/* Form card */}
        <form onSubmit={handleSubmit} className="card-elevated space-y-4">

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="input pl-10"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="label">Password</label>
              <Link
                to="/forgot-password"
                className="text-xs text-gold hover:text-gold transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="input pl-10 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error !== null && (
            <p className="text-sm text-error" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary btn-lg w-full"
          >
            {submitting ? 'Signing in…' : (
              <>Sign in <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-sm text-ink-3">
            No account?{' '}
            <Link to="/signup" className="text-gold hover:text-gold transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
