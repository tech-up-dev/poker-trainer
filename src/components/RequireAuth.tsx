import type { JSX } from 'react'
import { Navigate, Outlet } from 'react-router-dom'

import { supabase } from '../lib/supabase'
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
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-slate-300">This account doesn&apos;t have admin access.</p>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium"
        >
          Sign out
        </button>
      </div>
    )
  }

  return <Outlet />
}
