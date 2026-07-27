import { NavLink, useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import {
  Home,
  BookOpen,
  BookText,
  Library,
  BarChart3,
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
  { to: '/play',            icon: Home,     label: 'Trainer' },
  { to: '/play/lessons',    icon: BookOpen, label: 'Path' },
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
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-line flex flex-col transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 border-b border-line h-[72px]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-on-gold">B</span>
            </div>
            <div>
              <h1 className="font-bold text-base text-ink leading-tight">Beat Small Stakes</h1>
              <p className="text-xs text-ink-3">Poker Training</p>
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
        <div className="p-3 border-t border-line space-y-2">
          <NavLink
            to="/play/profile"
            onClick={onClose}
            className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}
          >
            <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
              {initial ? (
                <span className="text-gold font-semibold text-sm">{initial}</span>
              ) : (
                <User className="w-4 h-4 text-gold" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink truncate">{email}</p>
              <p className="text-xs text-ink-3">Profile</p>
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
