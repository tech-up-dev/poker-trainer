import { useEffect, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { ShieldCheck, ShieldAlert } from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'

type Enrollment = { factorId: string; qrCode: string; secret: string }

export function AdminSecurityPage(): JSX.Element {
  const [loading, setLoading] = useState(true)
  const [enrolled, setEnrolled] = useState(false)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabaseProd.auth.mfa
      .listFactors()
      .then(({ data }) => setEnrolled((data?.totp.length ?? 0) > 0))
      .catch(() => setEnrolled(false))
      .finally(() => setLoading(false))
  }, [])

  async function startEnroll(): Promise<void> {
    setBusy(true)
    setError(null)

    // Drop abandoned, never-verified attempts so enrolling again always works.
    const existing = await supabaseProd.auth.mfa.listFactors()
    for (const f of existing.data?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified') {
        await supabaseProd.auth.mfa.unenroll({ factorId: f.id })
      }
    }

    const { data, error: enrollError } = await supabaseProd.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Authenticator ${new Date().toISOString()}`,
    })
    setBusy(false)
    if (enrollError || !data) {
      setError(enrollError?.message ?? 'Could not start setup. Please try again.')
      return
    }
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
  }

  async function handleVerify(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!enrollment || busy) return
    setBusy(true)
    setError(null)
    const { error: verifyError } = await supabaseProd.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: code.trim(),
    })
    setBusy(false)
    if (verifyError) {
      setError('That code is not correct. Check the app and try again.')
      setCode('')
      return
    }
    setEnrollment(null)
    setCode('')
    setEnrolled(true)
  }

  if (loading) return <p className="text-sm text-ink-3">Loading…</p>

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Security</h1>
        <p className="text-sm text-ink-2 mt-1">Protect your admin account with an authenticator app.</p>
      </div>

      <div className="card space-y-4">
        {enrolled && !enrollment ? (
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-success shrink-0" />
            <div>
              <p className="font-semibold text-ink">Two-factor authentication is on</p>
              <p className="text-sm text-ink-2 mt-1">
                You will be asked for a code from your authenticator app each time you sign in to the admin area.
                If you lose your phone, ask the back-end developer to reset it.
              </p>
            </div>
          </div>
        ) : null}

        {!enrolled && !enrollment ? (
          <>
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-6 h-6 text-warning shrink-0" />
              <div>
                <p className="font-semibold text-ink">Two-factor authentication is off</p>
                <p className="text-sm text-ink-2 mt-1">
                  You will need an authenticator app such as Google Authenticator, Authy or 1Password.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => void startEnroll()} disabled={busy} className="btn-primary">
              {busy ? 'Starting…' : 'Set up two-factor authentication'}
            </button>
          </>
        ) : null}

        {enrollment ? (
          <form onSubmit={(e) => void handleVerify(e)} className="space-y-4">
            <p className="text-sm text-ink-2">1. Scan this QR code with your authenticator app.</p>
            <div className="flex justify-center">
              <img src={enrollment.qrCode} alt="Authenticator QR code" className="w-44 h-44 bg-white p-2 rounded-lg" />
            </div>
            <p className="text-xs text-ink-3 break-all">
              Cannot scan? Enter this key instead: <span className="font-mono text-ink-2">{enrollment.secret}</span>
            </p>
            <div className="space-y-1.5">
              <label htmlFor="enroll-code" className="label">2. Enter the 6-digit code it shows</label>
              <input
                id="enroll-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
                placeholder="123456"
                className="input text-center tracking-[0.4em] text-lg"
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => { setEnrollment(null); setCode(''); setError(null) }}
                className="text-sm text-ink-3 hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button type="submit" disabled={busy || code.length !== 6} className="btn-primary">
                {busy ? 'Verifying…' : 'Turn on'}
              </button>
            </div>
          </form>
        ) : null}

        {error !== null && <p className="text-sm text-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
