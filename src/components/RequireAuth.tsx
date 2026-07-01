import type { JSX } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from '../lib/auth-context'

// Route guard for the CMS. Sends anyone without a session to the login page, and
// shows a clear message (rather than a broken page) to a signed-in user who isn't
// an admin. RLS still enforces access at the database level regardless.
export function RequireAuth(): JSX.Element {
  const { session, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">
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

  return <Outlet />
}
