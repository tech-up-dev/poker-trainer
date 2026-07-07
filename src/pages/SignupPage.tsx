import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'

export function SignupPage(): JSX.Element {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
        emailRedirectTo: `${window.location.origin}/play`,
      },
    })

    setSubmitting(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError('An account with this email already exists. Try signing in instead.')
      return
    }

    if (data.session) {
      navigate('/play', { replace: true })
    } else {
      setEmailSent(true)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-[#18181b] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6 text-center">
          <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-zinc-100">Check your email</h1>
            <p className="text-sm text-zinc-400">
              We sent a confirmation link to{' '}
              <span className="text-zinc-100 font-medium">{email}</span>. Click it to activate your account.
            </p>
          </div>
          <Link
            to="/login"
            className="inline-block text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            Back to sign in
          </Link>
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
            <h1 className="text-xl font-bold text-zinc-100">Beat Small Stakes</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Create your account</p>
          </div>
        </div>

        {/* Form card */}
        <form onSubmit={handleSubmit} className="card-elevated space-y-4">

          {/* Email */}
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

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="label">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
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
              className="mt-0.5 h-4 w-4 rounded border-zinc-600 accent-brand-500 flex-shrink-0"
            />
            <span className="text-sm text-zinc-400 leading-snug">
              I confirm I am{' '}
              <span className="text-zinc-100 font-medium">18 years of age or older</span>
            </span>
          </label>

          {error !== null && (
            <p className="text-sm text-error" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn-primary btn-lg w-full"
          >
            {submitting ? 'Creating account…' : (
              <>Create account <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          <p className="text-center text-sm text-zinc-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors font-medium">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
