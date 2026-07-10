import { NavLink } from 'react-router-dom'
import type { JSX } from 'react'
import { Home, BookOpen, BookText, Library } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/play',          icon: Home,     label: 'Home'     },
  { to: '/play/lessons',  icon: BookOpen, label: 'Lessons'  },
  { to: '/play/glossary', icon: BookText, label: 'Glossary' },
  { to: '/play/library',  icon: Library,  label: 'Library'  },
]

export function MobileNav(): JSX.Element {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-surface border-t border-line lg:hidden z-30"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/play'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[56px] transition-colors ${
                isActive ? 'text-gold' : 'text-ink-3 hover:text-ink'
              }`
            }
          >
            <item.icon className="w-6 h-6" />
            <span className="text-xs font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
