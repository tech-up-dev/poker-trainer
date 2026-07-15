import type { JSX } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../lib/auth-context'

// Route guard for the member-facing app. Requires both a valid session and an
// active quiz_app_access entitlement. Users without a subscription are sent to
// /play/profile where the subscribe UI lives. The profile and checkout/success
// routes are exempted so users can complete or manage their subscription.
const EXEMPT_PATHS = ['/play/profile', '/play/checkout/success']

export function RequireSession(): JSX.Element {
  const { session, hasAccess, loading } = useAuth()
  const location = useLocation()

  // Block rendering only on the very first load before any session is known.
  // If a session already exists (e.g. background token refresh), keep the Outlet
  // mounted so in-progress lesson state isn't lost.
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-canvas text-ink-2 flex items-center justify-center">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // DEMO BYPASS - remove before Stripe credentials are wired up. The `true ||`
  // intentionally short-circuits the entitlement check so /play/* is open during
  // the demo; the eslint-disable keeps the branch lint-clean until it is reverted.
  // eslint-disable-next-line no-constant-binary-expression
  const isExempt = true || EXEMPT_PATHS.some((p) => location.pathname.startsWith(p))
  if (!hasAccess && !isExempt) {
    return <Navigate to="/play/profile" replace />
  }

  return <Outlet />
}
