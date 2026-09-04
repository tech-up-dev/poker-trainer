import { useState } from 'react'
import type { FormEvent, JSX } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowRight } from 'lucide-react'

import { PRICING_PLANS, createCheckoutSession } from '../lib/checkout'
import type { PricingPlan } from '../lib/checkout'

export function SubscribePage(): JSX.Element {
  const [email, setEmail] = useState('')
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleEmailSubmit(e: FormEvent): void {
    e.preventDefault()
    if (email.trim()) setEmailConfirmed(true)
  }

  async function handleSelect(plan: PricingPlan): Promise<void> {
    setCheckoutLoading(plan.id)
    setError(null)
    try {
      const { url } = await createCheckoutSession(plan.priceId, email.trim())
      window.location.assign(url)
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(
        code === 'already_subscribed'
          ? 'This email already has an active subscription. Sign in to access your account.'
          : err instanceof Error ? err.message : 'Could not start checkout. Please try again.',
      )
      setCheckoutLoading(null)
    }
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
            <h1 className="text-xl font-bold text-ink">Beat Small Stakes</h1>
            <p className="text-sm text-ink-3 mt-0.5">
              {emailConfirmed ? 'Choose a plan to get started' : 'Enter your email to get started'}
            </p>
          </div>
        </div>

        {!emailConfirmed ? (
          <form onSubmit={handleEmailSubmit} className="card-elevated space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
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
            <button type="submit" className="btn-primary btn-lg w-full">
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <div className="card-elevated space-y-3">
            <p className="text-xs text-ink-3">
              Subscribing as <span className="text-ink font-medium">{email}</span> ·{' '}
              <button
                type="button"
                onClick={() => setEmailConfirmed(false)}
                className="text-gold hover:opacity-80 transition-opacity"
              >
                Change
              </button>
            </p>

            {PRICING_PLANS.map((plan) => (
              <div
                key={plan.id}
                className="border border-line rounded-xl p-4 flex items-center justify-between gap-4 bg-surface-overlay"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{plan.label}</p>
                  <p className="text-xs text-ink-2">
                    <span className="text-ink font-semibold text-base">{plan.price}</span>
                    {' '}{plan.period}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleSelect(plan)}
                  disabled={checkoutLoading !== null}
                  className="btn-primary btn-sm shrink-0"
                >
                  {checkoutLoading === plan.id ? 'Redirecting…' : (
                    <>Select <ArrowRight className="w-3 h-3" /></>
                  )}
                </button>
              </div>
            ))}

            {error && (
              <p className="text-sm text-error" role="alert">{error}</p>
            )}
          </div>
        )}

        <p className="text-center text-sm text-ink-3">
          Already a member?{' '}
          <Link to="/login" className="text-gold font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
