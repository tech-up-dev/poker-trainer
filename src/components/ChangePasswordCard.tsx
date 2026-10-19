import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { useAuth } from '../lib/auth-context'
import { supabaseProd } from '../lib/supabase-prod'
import { TurnstileWidget } from './TurnstileWidget'
import { turnstileEnabled } from '../lib/turnstile'

export function ChangePasswordCard(): JSX.Element {
  const { session } = useAuth()
  const email = session?.user?.email ?? ''
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [captchaReset, setCaptchaReset] = useState(0)

  function close(): void {
    setOpen(false)
    setCurrent('')
    setNext('')
    setConfirm('')
    setShow(false)
    setError(null)
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (saving) return
    setError(null)
    setDone(false)
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return }
    if (next !== confirm) { setError('New passwords do not match.'); return }
    if (next === current) { setError('New password must be different from your current one.'); return }

    setSaving(true)
    const { error: verifyError } = await supabaseProd.auth.signInWithPassword({
      email,
      password: current,
      options: captchaToken ? { captchaToken } : undefined,
    })
    setCaptchaReset((n) => n + 1)
    if (verifyError) {
      setSaving(false)
      setError(
        verifyError.message.toLowerCase().includes('captcha')
          ? 'The security check did not pass. Please try again.'
          : 'Your current password is incorrect.',
      )
      return
    }
    const { error: updateError } = await supabaseProd.auth.updateUser({ password: next })
    setSaving(false)
    if (updateError) { setError(updateError.message); return }
    close()
    setDone(true)
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest">Password</p>
        {!open && (
          <button
            type="button"
            onClick={() => { setDone(false); setOpen(true) }}
            className="btn-secondary text-sm"
          >
            Change password
          </button>
        )}
      </div>

      {done && !open && (
        <p className="text-sm text-success" role="status">Your password has been updated.</p>
      )}

      {open && (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="current-password" className="label">Current password</label>
            <input
              id="current-password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className="input"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="new-password" className="label">New password</label>
            <div className="relative">
              <input
                id="new-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 characters"
                className="input pr-11"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Hide passwords' : 'Show passwords'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink transition-colors"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="confirm-password" className="label">Confirm new password</label>
            <input
              id="confirm-password"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="input"
            />
          </div>

          <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaReset} />

          {error !== null && <p className="text-sm text-error" role="alert">{error}</p>}

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={close} className="text-sm text-ink-3 hover:text-ink transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving || (turnstileEnabled && !captchaToken)} className="btn-primary">
              {saving ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
