import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../lib/auth-context'
import { getMfaStatus } from '../lib/mfa'

// Route guard for the CMS. Sends anyone without a session to the login page, and
// shows a clear message (rather than a broken page) to a signed-in user who isn't
// an admin. RLS still enforces access at the database level regardless.
// Admins who have enrolled an authenticator app are sent to a code screen first
// (the back end enforces this too once its switch is on).
export function RequireAuth(): JSX.Element {
  const { session, isAdmin, loading } = useAuth()
  const location = useLocation()
  // The answer is tied to which side of the code page it was computed on. Without
  // that, a correct code sends the admin to /admin, the guard still holds the old
  // "needs a code" answer, and bounces them back to the code page once.
  const [mfa, setMfa] = useState<{ forVerifyPage: boolean; needs: boolean } | null>(null)
  const onVerifyPage = location.pathname === '/admin/verify'
  const mfaReady = mfa !== null && mfa.forVerifyPage === onVerifyPage

  useEffect(() => {
    if (loading || !session || !isAdmin) return
    let cancelled = false
    // If the check itself fails we let the admin through; the back end is the real gate.
    getMfaStatus()
      .then((s) => { if (!cancelled) setMfa({ forVerifyPage: onVerifyPage, needs: s.needsChallenge }) })
      .catch(() => { if (!cancelled) setMfa({ forVerifyPage: onVerifyPage, needs: false }) })
    return () => { cancelled = true }
  }, [loading, session, isAdmin, onVerifyPage])

  // Show a spinner on first load (no session yet) or while entitlements are
  // still resolving for an existing session - prevents a false redirect to /play
  // before isAdmin has been confirmed.
  if (loading || (session && isAdmin && !mfaReady)) {
    return (
      <div className="min-h-screen bg-canvas text-ink-2 flex items-center justify-center">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/play" replace />
  }

  if (mfa?.needs && !onVerifyPage) {
    return <Navigate to="/admin/verify" replace state={{ from: location.pathname + location.search }} />
  }

  return <Outlet />
}
