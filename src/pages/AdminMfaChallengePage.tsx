import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'

export function AdminMfaChallengePage(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/admin/dashboard'
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const factors = await supabaseProd.auth.mfa.listFactors()
    const factor = factors.data?.totp[0]
    if (!factor) {
      setSubmitting(false)
      setError('No authenticator app is set up for this account.')
      return
    }

    const { error: verifyError } = await supabaseProd.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: code.trim(),
    })
    setSubmitting(false)
    if (verifyError) {
      setError('That code is not correct. Check the app and try again.')
      setCode('')
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gold flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-7 h-7 text-on-gold" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-ink">Two-factor verification</h1>
            <p className="text-sm text-ink-3 mt-0.5">Enter the 6-digit code from your authenticator app.</p>
          </div>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="card-elevated space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="mfa-code" className="label">Authentication code</label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
              placeholder="123456"
              className="input text-center tracking-[0.4em] text-lg"
            />
          </div>

          {error !== null && <p className="text-sm text-error" role="alert">{error}</p>}

          <button type="submit" disabled={submitting || code.length !== 6} className="btn-primary btn-lg w-full">
            {submitting ? 'Verifying…' : 'Verify'}
          </button>

          <button
            type="button"
            onClick={() => void supabaseProd.auth.signOut().then(() => navigate('/login', { replace: true }))}
            className="w-full text-center text-sm text-ink-3 hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
