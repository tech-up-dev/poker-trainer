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
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-6 flex-wrap">
          <span className="font-bold text-ink">Poker Trainer · Content Ops</span>
          <nav className="flex flex-wrap gap-1">
            <NavLink to="/admin/import"       className={navClass}>Bulk Import</NavLink>
            <NavLink to="/admin"        end   className={navClass}>Lesson</NavLink>
            <NavLink to="/admin/glossary"     className={navClass}>Glossary</NavLink>
            <NavLink to="/admin/tips"         className={navClass}>Tip</NavLink>
            <NavLink to="/admin/references"   className={navClass}>Reference</NavLink>
            <NavLink to="/admin/staging"      className={navClass}>Staging</NavLink>
            <NavLink to="/admin/table-builder"className={navClass}>Table Builder</NavLink>
            <NavLink to="/admin/wizard"       className={navClass}>Wizard</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm text-ink-3">
            {session?.user.email ? <span>{session.user.email}</span> : null}
            <button
              type="button"
              onClick={() => void supabaseProd.auth.signOut()}
              className="px-3 py-1.5 rounded-lg bg-surface-raised hover:bg-surface-overlay text-ink font-medium transition-colors border border-line"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
