import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { supabaseProd } from '../lib/supabase-prod'

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

export function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Supabase fires PASSWORD_RECOVERY via onAuthStateChange when the page loads
  // with a valid recovery token in the URL hash.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseProd.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const { error: updateError } = await supabaseProd.auth.updateUser({ password })

    setSubmitting(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setDone(true)
    setTimeout(() => navigate('/login', { replace: true }), 2000)
  }

  if (done) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center space-y-3">
          <h1 className="text-2xl font-bold text-ink">Password updated</h1>
          <p className="text-sm text-ink-2">Redirecting you to sign in...</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-sm text-ink-2">Verifying reset link...</p>
          <p className="text-xs text-ink-3">
            If nothing happens,{' '}
            <Link to="/forgot-password" className="text-link hover:text-ink transition-colors">
              request a new link
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-ink">Set new password</h1>
          <p className="text-sm text-ink-2">Choose a new password for your account.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-line rounded-2xl p-6 space-y-5"
        >
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              New password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 characters"
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
            {submitting ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
