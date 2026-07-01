import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link } from 'react-router-dom'

import { supabaseProd } from '../lib/supabase-prod'

export function ForgotPasswordPage(): JSX.Element {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    const { error: resetError } = await supabaseProd.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setSubmitting(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-ink">Check your email</h1>
            <p className="text-sm text-ink-2">
              If <span className="text-ink font-medium">{email}</span> is registered,
              you will receive a password reset link shortly.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-block text-sm text-link hover:text-ink transition-colors"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-ink">Forgot password?</h1>
          <p className="text-sm text-ink-2">
            Enter your email and we will send you a reset link.
          </p>
        </div>

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
            {submitting ? 'Sending...' : 'Send reset link'}
          </button>

          <p className="text-center text-sm text-ink-2">
            <Link to="/login" className="text-link hover:text-ink transition-colors font-medium">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
