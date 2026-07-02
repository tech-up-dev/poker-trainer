import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../lib/auth-context'
import { supabaseProd } from '../lib/supabase-prod'
import { MemberHeader } from '../components/MemberHeader'

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
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  function statusLabel(status: string): string {
    if (status === 'active') return 'Active'
    if (status === 'cancelled') return 'Cancelled'
    if (status === 'past_due') return 'Past due'
    return status
  }

  function statusColor(status: string): string {
    if (status === 'active') return 'text-success'
    if (status === 'past_due') return 'text-gold'
    return 'text-error'
  }

  return (
    <div className="min-h-screen bg-canvas text-ink px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        <MemberHeader />

        <Link to="/play" className="inline-block text-sm text-link hover:text-ink transition-colors">
          &larr; Back to lessons
        </Link>

        <h2 className="text-xl font-semibold">Profile</h2>

        {loading && <p className="text-sm text-ink-2">Loading...</p>}

        {error !== null && (
          <p className="text-sm text-error" role="alert">
            {error}
          </p>
        )}

        {!loading && (
          <div className="space-y-4">
            {entitlement !== null ? (
              <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
                <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest">
                  Subscription
                </p>

                <div className="space-y-3">
                  <Row label="Plan" value="Beat Small Stakes" />
                  <Row
                    label="Status"
                    value={statusLabel(entitlement.status)}
                    valueClass={statusColor(entitlement.status)}
                  />
                  <Row
                    label="Next billing date"
                    value={formatDate(entitlement.expires_at)}
                  />
                </div>

                <div className="pt-1 border-t border-line">
                  <button
                    type="button"
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="w-full py-3 rounded-xl bg-gold text-on-gold font-semibold text-sm hover:bg-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {portalLoading ? 'Opening...' : 'Manage billing'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-line rounded-xl p-5">
                <p className="text-sm text-ink-2">No active subscription found.</p>
              </div>
            )}

            <div className="bg-surface border border-line rounded-xl p-5 space-y-1">
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest">
                Account
              </p>
              <p className="text-sm text-ink">{session?.user?.email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  valueClass = 'text-ink',
}: {
  label: string
  value: string
  valueClass?: string
}): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-2">{label}</span>
      <span className={`text-sm font-medium ${valueClass}`}>{value}</span>
    </div>
  )
}
