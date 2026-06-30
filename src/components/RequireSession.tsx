import type { JSX } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../lib/auth-context'

// Route guard for the member-facing app. Unlike RequireAuth (admin-only), this
// only requires a signed-in session — member entitlements/auth land in M3, so
// for now any authenticated account (including the admin's) can reach these
// routes. RLS on content_published already requires `auth.role() = 'authenticated'`.
export function RequireSession(): JSX.Element {
  const { session, loading } = useAuth()

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

  return <Outlet />
}
