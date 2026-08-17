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

  // Block rendering until both session and entitlements are known. We can't
  // safely evaluate hasAccess until resolveEntitlements has run — showing a
  // loading screen is cheaper than a spurious redirect to /play/profile.
  // TOKEN_REFRESHED never sets loading=true (skipped in auth.tsx), so an
  // in-progress lesson stays mounted during background refreshes.
  if (loading) {
    return (
      <div className="min-h-screen bg-canvas text-ink-2 flex items-center justify-center">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  const isExempt = EXEMPT_PATHS.some((p) => location.pathname.startsWith(p))
  if (!hasAccess && !isExempt) {
    return <Navigate to="/play/profile" replace />
  }

  return <Outlet />
}
