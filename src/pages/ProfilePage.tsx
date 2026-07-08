import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { useAuth } from '../lib/auth-context'
import { supabaseProd } from '../lib/supabase-prod'
import { PRICING_PLANS, createCheckoutSession } from '../lib/checkout'
import type { PricingPlan } from '../lib/checkout'

type Entitlement = {
  entitlement_key: string
  status: string
  expires_at: string | null
  stripe_price_id: string | null
}

export function ProfilePage(): JSX.Element {
  const { session } = useAuth()
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    supabaseProd
      .from('entitlements')
      .select('entitlement_key, status, expires_at, stripe_price_id')
      .eq('user_id', session.user.id)
      .eq('entitlement_key', 'quiz_app_access')
      .maybeSingle()
      .then(({ data, error: dbErr }) => {
        if (dbErr) setError(dbErr.message)
        else setEntitlement(data)
        setLoading(false)
      })
  }, [session])

  async function handleSubscribe(plan: PricingPlan): Promise<void> {
    setCheckoutLoading(plan.id)
    setError(null)
    try {
      const { url } = await createCheckoutSession(plan.priceId)
      window.location.assign(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
      setCheckoutLoading(null)
    }
  }

  async function handleManageBilling(): Promise<void> {
    setPortalLoading(true)
    setError(null)
    const { data, error: fnErr } = await supabaseProd.functions.invoke('billing-portal', {
      body: { return_url: window.location.href },
    })
    setPortalLoading(false)
    if (fnErr || !(data as { url?: string })?.url) {
      setError('Could not open billing portal. Please try again.')
      return
    }
    window.location.href = (data as { url: string }).url
  }

  function formatDate(iso: string | null): string {
    if (!iso) return 'N/A'
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    })
  }

  function statusLabel(status: string): string {
    if (status === 'active') return 'Active'
    if (status === 'cancelled') return 'Cancelled'
    if (status === 'past_due') return 'Past due'
    return status
  }

  function statusBadgeClass(status: string): string {
    if (status === 'active') return 'badge-success'
    if (status === 'past_due') return 'badge-warning'
    return 'badge-error'
  }

  const email = session?.user?.email ?? ''
  const initial = email.charAt(0).toUpperCase()

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Account card */}
      <div className="card flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
          <span className="text-gold font-bold text-xl">{initial}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{email}</p>
          <p className="text-sm text-ink-3">Member</p>
        </div>
      </div>

      {error !== null && (
        <p className="text-sm text-error" role="alert">{error}</p>
      )}

      {loading && <p className="text-sm text-ink-3">Loading…</p>}

      {!loading && (
        <div className="space-y-4">
          {/* Subscription */}
          {entitlement !== null ? (
            <div className="card space-y-4">
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest">
                Subscription
              </p>
              <div className="space-y-3">
                <Row label="Plan" value="Beat Small Stakes" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-ink-2">Status</span>
                  <span className={statusBadgeClass(entitlement.status)}>
                    {statusLabel(entitlement.status)}
                  </span>
                </div>
                <Row label="Next billing" value={formatDate(entitlement.expires_at)} />
              </div>
              <div className="pt-1 border-t border-line">
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="btn-primary w-full"
                >
                  {portalLoading ? 'Opening…' : 'Manage billing'}
                </button>
              </div>
            </div>
          ) : (
            <div className="card space-y-4">
              <div>
                <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest">
                  Subscribe
                </p>
                <p className="text-sm text-ink-2 mt-1">
                  Get full access to all lessons, tips, and references.
                </p>
              </div>
              <div className="space-y-3">
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
                      onClick={() => handleSubscribe(plan)}
                      disabled={checkoutLoading !== null}
                      className="btn-primary btn-sm shrink-0"
                    >
                      {checkoutLoading === plan.id ? 'Redirecting…' : 'Subscribe'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-2">{label}</span>
      <span className="text-sm text-ink font-medium">{value}</span>
    </div>
  )
}
