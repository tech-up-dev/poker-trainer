import { useState } from 'react'
import type { JSX } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  Upload,
  PenTool,
  GitBranch,
  Table2,
  Wand2,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  User,
} from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'
import { useAuth } from '../lib/auth-context'
import { useTheme } from '../lib/theme-context'

const NAV_ITEMS = [
  { to: '/admin/import',        icon: Upload,    label: 'Bulk Import'   },
  { to: '/admin',               icon: PenTool,   label: 'Editor',  end: true },
  { to: '/admin/staging',       icon: GitBranch, label: 'Staging'       },
  { to: '/admin/table-builder', icon: Table2,    label: 'Table Builder' },
  { to: '/admin/wizard',        icon: Wand2,     label: 'Wizard'        },
]

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'flex items-center gap-3 px-4 py-3 rounded-xl text-gold bg-gold/10 hover:bg-gold/15 transition-colors'
    : 'flex items-center gap-3 px-4 py-3 rounded-xl text-ink-2 hover:text-ink hover:bg-surface-overlay transition-colors'
}

interface AdminSidebarProps {
  isOpen: boolean
  onClose: () => void
}

function AdminSidebar({ isOpen, onClose }: AdminSidebarProps): JSX.Element {
  const { session } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const email = session?.user?.email ?? ''
  const initial = email.charAt(0).toUpperCase()

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-line flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 border-b border-line h-[72px] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-on-gold">B</span>
            </div>
            <div>
              <h1 className="font-bold text-base text-ink leading-tight">Content Ops</h1>
              <p className="text-xs text-ink-3">Admin Mode</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-surface-overlay text-ink-2 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={navClass}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User + actions */}
        <div className="p-3 border-t border-line space-y-1 shrink-0">
          {/* User info */}
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              {initial
                ? <span className="text-gold font-semibold text-sm">{initial}</span>
                : <User className="w-4 h-4 text-gold" />}
            </div>
            <p className="text-sm text-ink truncate flex-1 min-w-0">{email}</p>
          </div>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-ink-2 hover:text-ink hover:bg-surface-overlay transition-colors"
          >
            {theme === 'dark'
              ? <Sun className="w-5 h-5 shrink-0" />
              : <Moon className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-medium">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          </button>

          {/* Sign out */}
          <button
            type="button"
            onClick={() => void supabaseProd.auth.signOut()}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-error hover:bg-error/10 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    </>
  )
}

export function AdminLayout(): JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas text-ink flex">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Mobile topbar */}
        <header className="lg:hidden sticky top-0 z-30 bg-canvas/95 backdrop-blur-sm border-b border-line">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-surface-raised text-ink-2 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
                <span className="text-sm font-bold text-on-gold">B</span>
              </div>
              <span className="font-bold text-sm text-ink">Content Ops</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
