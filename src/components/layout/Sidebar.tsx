import { NavLink, useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import {
  Home,
  BookOpen,
  BarChart3,
  BookText,
  Library,
  LogOut,
  X,
  User,
} from 'lucide-react'

import { useAuth } from '../../lib/auth-context'
import { supabaseProd } from '../../lib/supabase-prod'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

const NAV_ITEMS = [
  { to: '/play',            icon: Home,     label: 'Dashboard' },
  { to: '/play/lessons',    icon: BookOpen, label: 'Lessons' },
  { to: '/play/glossary',   icon: BookText, label: 'Glossary' },
  { to: '/play/library',    icon: Library,  label: 'Library' },
  { to: '/play/stats',      icon: BarChart3,label: 'Stats' },
]

export function Sidebar({ isOpen, onClose }: SidebarProps): JSX.Element {
  const { session } = useAuth()
  const navigate = useNavigate()
  const email = session?.user?.email ?? ''
  const initial = email.charAt(0).toUpperCase()

  async function handleLogout(): Promise<void> {
    onClose()
    await supabaseProd.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {/* Sidebar panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-raised border-r border-zinc-800 flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-zinc-900">B</span>
            </div>
            <div>
              <h1 className="font-bold text-base text-zinc-100 leading-tight">Beat Small Stakes</h1>
              <p className="text-xs text-zinc-500">Poker Training</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-2 rounded-lg hover:bg-surface-overlay text-zinc-400 transition-colors"
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
              end={item.to === '/play'}
              onClick={onClose}
              className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User + sign out */}
        <div className="p-3 border-t border-zinc-800 space-y-2">
          <NavLink
            to="/play/profile"
            onClick={onClose}
            className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
          >
            <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center shrink-0">
              {initial ? (
                <span className="text-brand-500 font-semibold text-sm">{initial}</span>
              ) : (
                <User className="w-4 h-4 text-brand-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100 truncate">{email}</p>
              <p className="text-xs text-zinc-500">Profile</p>
            </div>
          </NavLink>

          <button
            type="button"
            onClick={handleLogout}
            className="nav-item w-full text-error hover:bg-error/10"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>Sign Out</span>
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
