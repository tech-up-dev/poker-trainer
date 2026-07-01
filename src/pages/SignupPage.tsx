import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { supabaseProd } from '../lib/supabase-prod'

export function SignupPage(): JSX.Element {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [ageVerified, setAgeVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (submitting) return
    if (!ageVerified) {
      setError('You must be 18 or older to create an account.')
      return
    }

    setSubmitting(true)
    setError(null)

    const { data, error: signUpError } = await supabaseProd.auth.signUp({
      email,
      password,
      options: {
        data: { age_verified: true },
      },
    })

    setSubmitting(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // If Supabase returns a session the project has auto-confirm on.
    // Otherwise the user must confirm via email before they can sign in.
    if (data.session) {
      navigate('/play', { replace: true })
    } else {
      setEmailSent(true)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-ink">Check your email</h1>
            <p className="text-sm text-ink-2">
              We sent a confirmation link to{' '}
              <span className="text-ink font-medium">{email}</span>. Click it to
              activate your account.
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

        {/* Branding */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-ink">Beat Small Stakes</h1>
          <p className="text-sm text-ink-2">Create your account</p>
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
            <label htmlFor="password" className="block text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min. 8 characters"
              className="w-full px-4 py-3 rounded-xl bg-canvas border border-line text-ink text-sm placeholder:text-ink-3 focus:outline-none focus:border-link transition-colors"
            />
          </div>

          {/* Age verification */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={ageVerified}
              onChange={(e) => {
                setAgeVerified(e.target.checked)
                if (error) setError(null)
              }}
              className="mt-0.5 h-4 w-4 rounded border-line accent-gold flex-shrink-0"
            />
            <span className="text-sm text-ink-2 leading-snug">
              I confirm I am{' '}
              <span className="text-ink font-medium">18 years of age or older</span>
            </span>
          </label>

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
            {submitting ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-center text-sm text-ink-2">
            Already have an account?{' '}
            <Link to="/login" className="text-link hover:text-ink transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
