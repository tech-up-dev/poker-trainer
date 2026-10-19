import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { useAuth } from '../lib/auth-context'
import { supabaseProd } from '../lib/supabase-prod'
import { pollForEntitlement } from '../lib/checkout'

// Route guard for the member-facing app. Requires both a valid session and an
// active quiz_app_access entitlement. Users without a subscription are sent to
// /play/profile where the subscribe UI lives. The profile and checkout/success
// routes are exempted so users can complete or manage their subscription.
const EXEMPT_PATHS = ['/play/profile', '/play/checkout/success']

// Set by the password-set and checkout flows for a brand-new member whose
// quiz_app_access grant may still be propagating (GHL tag sync can lag the
// password-setup email by a minute or two). While it is present we show an
// "activating access" screen and poll, instead of bouncing the new member onto
// the Subscribe page as if they had never paid.
export const AWAITING_ACCESS_KEY = 'bss_awaiting_access'

function readAwaitingAccess(): boolean {
  try {
    return localStorage.getItem(AWAITING_ACCESS_KEY) === '1'
  } catch {
    return false
  }
}

function clearAwaitingAccess(): void {
  try {
    localStorage.removeItem(AWAITING_ACCESS_KEY)
  } catch {
    /* ignore - storage unavailable */
  }
}

export function RequireSession(): JSX.Element {
  const { session, hasAccess, loading } = useAuth()
  const location = useLocation()

  // Block rendering until both session and entitlements are known. We can't
  // safely evaluate hasAccess until resolveEntitlements has run - showing a
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
    // A just-activated member's grant may still be in flight. Only such members
    // carry the awaiting-access flag, so genuine non-subscribers still fall
    // straight through to the Subscribe page with no added wait.
    if (readAwaitingAccess()) {
      return <ActivatingAccess />
    }
    return <Navigate to="/play/profile" replace />
  }

  // Access is confirmed - make sure the one-shot activation flag is cleared.
  if (hasAccess) clearAwaitingAccess()

  return <Outlet />
}

// Shown to a brand-new member whose entitlement is still propagating. Polls for
// the grant and, once it lands, refreshes the cached entitlement flags so the
// guard re-renders into the app. On timeout it falls back to the Subscribe page
// rather than spinning forever.
function ActivatingAccess(): JSX.Element {
  const { refreshEntitlements } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run(): Promise<void> {
      const { data } = await supabaseProd.auth.getUser()
      const userId = data.user?.id
      if (!userId) {
        if (!cancelled) setTimedOut(true)
        return
      }
      const granted = await pollForEntitlement(userId, 90000, 3000)
      if (cancelled) return
      if (granted) {
        clearAwaitingAccess()
        // Flips hasAccess true; the guard re-renders and this component unmounts.
        await refreshEntitlements()
      } else {
        clearAwaitingAccess()
        setTimedOut(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [refreshEntitlements])

  if (timedOut) {
    return <Navigate to="/play/profile" replace />
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <Loader2 className="w-12 h-12 text-gold animate-spin mx-auto" />
        <div>
          <h1 className="text-xl font-bold text-ink">Activating your access</h1>
          <p className="text-sm text-ink-3 mt-1">Setting up your account, this only takes a moment…</p>
        </div>
      </div>
    </div>
  )
}
