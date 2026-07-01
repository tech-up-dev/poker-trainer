import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { supabaseProd } from '../lib/supabase-prod'
import { useAuth } from '../lib/auth-context'

function EyeIcon({ open }: { open: boolean }): JSX.Element {
  if (open) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export function LoginPage(): JSX.Element {
  const navigate = useNavigate()
  const { session, isAdmin, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Don't auto-redirect - show the form even when a session exists so users can
  // switch accounts. A banner lets them continue with the current account instead.
  const existingEmail = session?.user.email ?? null

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

        {/* Already-signed-in banner */}
        {!loading && existingEmail && (
          <div className="bg-surface border border-line rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-2 truncate">
              Signed in as <span className="text-ink font-medium">{existingEmail}</span>
            </p>
            <Link
              to={isAdmin ? '/admin' : '/play'}
              className="text-sm text-link hover:text-ink font-medium whitespace-nowrap transition-colors"
            >
              Continue &rarr;
            </Link>
          </div>
        )}

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
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-11 rounded-xl bg-canvas border border-line text-ink text-sm placeholder:text-ink-3 focus:outline-none focus:border-link transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors"
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
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
