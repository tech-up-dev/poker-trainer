import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'
import { useAuth } from '../lib/auth-context'
import { pollForEntitlement } from '../lib/checkout'
import { AWAITING_ACCESS_KEY } from '../components/RequireSession'

export function ResetPasswordPage(): JSX.Element {
  const navigate = useNavigate()
  const { refreshEntitlements } = useAuth()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [activating, setActivating] = useState(false)
  // Links from the new email template carry a one-time token_hash. It is only
  // spent when the person clicks Continue, so mail scanners that open links
  // automatically can't use it up.
  const [tokenHash] = useState(() => new URLSearchParams(window.location.search).get('token_hash'))
  const [verifying, setVerifying] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    // New-style links are verified by the Continue button instead.
    if (tokenHash) return

    // Register the listener before anything else so we don't miss the event.
    const {
      data: { subscription },
    } = supabaseProd.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true)
    })

    // Supabase fires PASSWORD_RECOVERY during client init (before this component
    // mounts), so the listener above often misses it. As a fallback, check
    // getSession() - if the session is already established, show the form.
    void supabaseProd.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [tokenHash])

  async function handleContinue(): Promise<void> {
    if (!tokenHash || verifying) return
    setVerifying(true)
    setLinkError(null)
    const { error: verifyError } = await supabaseProd.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
    setVerifying(false)
    if (verifyError) {
      setLinkError('This reset link has expired or was already used.')
      return
    }
    window.history.replaceState(null, '', window.location.pathname)
    setReady(true)
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const { error: updateError } = await supabaseProd.auth.updateUser({ password })

    if (updateError) {
      setSubmitting(false)
      setError(updateError.message)
      return
    }

    // The recovery link signs the user in, so they already hold a session here.
    const { data: userData } = await supabaseProd.auth.getUser()
    const userId = userData.user?.id

    if (!userId) {
      // No session (e.g. a reset flow that did not auto-sign-in) - fall back to login.
      setSubmitting(false)
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
      return
    }

    // Branch on the account's current access so we don't send everyone through the
    // new-member activation path. Read the live entitlement state directly (the
    // cached auth flags can be stale right after a user update).
    const { data: ents } = await supabaseProd
      .from('entitlements')
      .select('entitlement_key')
      .in('entitlement_key', ['admin_access', 'quiz_app_access'])
      .eq('status', 'active')
    const keys = (ents ?? []).map((r) => r.entitlement_key as string)

    await refreshEntitlements()

    // Admin resetting their password: keep them in the CMS, not the member app.
    if (keys.includes('admin_access')) {
      navigate('/', { replace: true })
      return
    }
    // Existing member with access already: straight to the homepage.
    if (keys.includes('quiz_app_access')) {
      navigate('/play', { replace: true })
      return
    }

    // No active access yet - this is a brand-new member (purchased in GHL or via
    // Stripe) whose quiz_app_access grant is still propagating. Flag the in-flight
    // activation so that if the grant outlasts this screen's poll, the member
    // route shows an activating state rather than the Subscribe page.
    try { localStorage.setItem(AWAITING_ACCESS_KEY, '1') } catch { /* storage unavailable */ }
    setActivating(true)

    const granted = await pollForEntitlement(userId)
    if (granted) {
      try { localStorage.removeItem(AWAITING_ACCESS_KEY) } catch { /* storage unavailable */ }
    }
    // Refresh the cached flags either way: on success so the homepage renders
    // without a bounce; on timeout the awaiting flag keeps the member route
    // graceful while the grant finishes landing.
    await refreshEntitlements()
    navigate('/play', { replace: true })
  }

  if (activating) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center space-y-4">
          <Loader2 className="w-14 h-14 text-gold animate-spin mx-auto" />
          <h1 className="text-xl font-bold text-ink">Setting up your account</h1>
          <p className="text-sm text-ink-2">Confirming your access, just a moment…</p>
        </div>
      </div>
    )
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

  if (!ready && tokenHash) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gold flex items-center justify-center shadow-lg">
              <span className="text-2xl font-bold text-on-gold">B</span>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-ink">Reset your password</h1>
              <p className="text-sm text-ink-3 mt-0.5">Click continue to choose a new password.</p>
            </div>
          </div>
          <div className="card-elevated space-y-4">
            {linkError !== null && (
              <p className="text-sm text-error" role="alert">
                {linkError}{' '}
                <Link to="/forgot-password" className="text-gold underline underline-offset-2">
                  Request a new link
                </Link>
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={verifying || linkError !== null}
              className="btn-primary btn-lg w-full"
            >
              {verifying ? 'Checking…' : (
                <>Continue <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </div>
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
