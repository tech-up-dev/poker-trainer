import type { JSX } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const linkBase = 'px-3 py-1.5 rounded text-sm font-medium transition-colors'

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? `${linkBase} bg-slate-700 text-white`
    : `${linkBase} text-slate-300 hover:bg-slate-800 hover:text-white`
}

// Shell for the Content Ops (admin) area: a top bar with the tool nav and an
// Outlet for the active page. Keeps the dark theme the validator already uses.
export function AdminLayout(): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-6">
          <span className="font-semibold">Poker Trainer · Content Ops</span>
          <nav className="flex gap-2">
            {/* `end` so /admin isn't highlighted while on /admin/import */}
            <NavLink to="/admin" end className={navClass}>
              Validator
            </NavLink>
            <NavLink to="/admin/import" className={navClass}>
              Bulk Import
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  )
}
