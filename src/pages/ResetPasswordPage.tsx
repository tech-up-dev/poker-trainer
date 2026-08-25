import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'

export function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    // Register the listener before anything else so we don't miss the event.
    const {
      data: { subscription },
    } = supabaseProd.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })

    // Supabase fires PASSWORD_RECOVERY during client init (before this component
    // mounts), so the listener above often misses it. As a fallback, check
    // getSession() — if the session is already established, show the form.
    void supabaseProd.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
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
        <div className="w-full max-w-sm text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
          <h1 className="text-xl font-bold text-ink">Password updated</h1>
          <p className="text-sm text-ink-2">Redirecting you to sign in…</p>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-sm text-ink-2">Verifying reset link…</p>
          <p className="text-xs text-ink-3">
            If nothing happens,{' '}
            <Link to="/forgot-password" className="text-gold hover:text-gold transition-colors">
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
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gold flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-on-gold">B</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-ink">Set new password</h1>
            <p className="text-sm text-ink-3 mt-0.5">Choose a new password for your account.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="password" className="label">New password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 characters"
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
            {submitting ? 'Updating…' : (
              <>Update password <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
