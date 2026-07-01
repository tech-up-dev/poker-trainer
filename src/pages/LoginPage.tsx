import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { supabaseProd } from '../lib/supabase-prod'
import { useAuth } from '../lib/auth-context'

export function LoginPage(): JSX.Element {
  const navigate = useNavigate()
  const { session, isAdmin, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) {
    return <Navigate to={isAdmin ? '/admin' : '/play'} replace />
  }

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

    // Check admin entitlement directly so we can route without waiting for the
    // auth-context listener to fire.
    const { data } = await supabaseProd
      .from('entitlements')
      .select('entitlement_key')
      .eq('entitlement_key', 'admin_access')
      .eq('status', 'active')
      .maybeSingle()

    navigate(data ? '/admin' : '/play', { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">

        {/* Branding */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-ink">Beat Small Stakes</h1>
          <p className="text-sm text-ink-2">Sign in to your account</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-line rounded-2xl p-6 space-y-5"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl bg-canvas border border-line text-ink text-sm placeholder:text-ink-3 focus:outline-none focus:border-link transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-medium text-ink">
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs text-link hover:text-ink-2 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-canvas border border-line text-ink text-sm placeholder:text-ink-3 focus:outline-none focus:border-link transition-colors"
            />
          </div>

          {error !== null && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gold text-on-gold font-semibold text-sm hover:bg-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-ink-2">
            No account?{' '}
            <Link to="/signup" className="text-link hover:text-ink transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
