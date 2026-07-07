import { useEffect, useRef, useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowRight, CheckCircle2 } from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'

const COOLDOWN_SECONDS = 60

function friendlyError(message: string): string {
  if (/rate.limit/i.test(message)) {
    return 'Too many requests. Please wait a minute before trying again.'
  }
  return message
}

export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function startCooldown(): void {
    setCooldown(COOLDOWN_SECONDS)
    timerRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (submitting || cooldown > 0) return
    setSubmitting(true)
    setError(null)

    const { error: resetError } = await supabaseProd.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setSubmitting(false)

    if (resetError) {
      setError(friendlyError(resetError.message))
      return
    }

    startCooldown()
    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-[#18181b] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6 text-center">
          <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-zinc-100">Check your email</h1>
            <p className="text-sm text-zinc-400">
              If <span className="text-zinc-100 font-medium">{email}</span> is registered,
              you will receive a password reset link shortly.
            </p>
          </div>

          {error !== null && (
            <p className="text-sm text-error" role="alert">{error}</p>
          )}

          <button
            type="button"
            disabled={cooldown > 0 || submitting}
            onClick={() => { setSent(false); setError(null) }}
            className="text-sm text-brand-400 hover:text-brand-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend email'}
          </button>

          <div>
            <Link
              to="/login"
              className="inline-block text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#18181b] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg">
            <span className="text-2xl font-bold text-zinc-900">B</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-zinc-100">Forgot password?</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Enter your email and we'll send you a reset link.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="card-elevated space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="label">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
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

          {error !== null && (
            <p className="text-sm text-error" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary btn-lg w-full"
          >
            {submitting ? 'Sending…' : (
              <>Send reset link <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-sm text-zinc-500">
            <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
