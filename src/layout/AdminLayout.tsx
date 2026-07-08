import type { JSX } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { supabaseProd } from '../lib/supabase-prod'
import { useAuth } from '../lib/auth-context'

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'px-3 py-1.5 rounded-lg text-sm font-medium bg-gold/10 text-gold transition-colors'
    : 'px-3 py-1.5 rounded-lg text-sm font-medium text-ink-2 hover:text-ink hover:bg-surface-raised transition-colors'
}

export function AdminLayout(): JSX.Element {
  const { session } = useAuth()

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top row: branding + sign out */}
          <div className="flex items-center justify-between gap-3 py-3">
            <span className="font-bold text-ink text-sm sm:text-base whitespace-nowrap">
              Poker Trainer · Content Ops
            </span>
            <div className="flex items-center gap-2 text-sm text-ink-3 min-w-0">
              {session?.user.email ? (
                <span className="truncate hidden sm:block max-w-[180px]">{session.user.email}</span>
              ) : null}
              <button
                type="button"
                onClick={() => void supabaseProd.auth.signOut()}
                className="px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay text-ink font-medium transition-colors border border-line whitespace-nowrap shrink-0"
              >
                Sign out
              </button>
            </div>
          </div>
          {/* Nav row: scrollable on mobile */}
          <nav className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            <NavLink to="/admin/import"        className={navClass}>Bulk Import</NavLink>
            <NavLink to="/admin"         end   className={navClass}>Editor</NavLink>
            <NavLink to="/admin/staging"       className={navClass}>Staging</NavLink>
            <NavLink to="/admin/table-builder" className={navClass}>Table Builder</NavLink>
            <NavLink to="/admin/wizard"        className={navClass}>Wizard</NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
