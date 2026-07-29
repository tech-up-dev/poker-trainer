import { Flame, Menu, Sun, Moon } from 'lucide-react'
import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import { fetchStreak } from '../../lib/streak'
import { useTheme } from '../../lib/theme-context'

interface TopBarProps {
  onMenuClick?: () => void
}

export function TopBar({ onMenuClick }: TopBarProps): JSX.Element {
  const [streak, setStreak] = useState(0)
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    fetchStreak()
      .then((s) => setStreak(s.current))
      .catch(() => {})
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-canvas/95 backdrop-blur-sm border-b border-line">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="lg:hidden p-2 rounded-lg hover:bg-surface-raised text-ink-2 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          )}

          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gold flex items-center justify-center">
              <span className="text-sm font-bold text-on-gold">B</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {streak > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gold/10 rounded-full">
              <Flame className="w-5 h-5 text-gold" />
              <span className="text-base font-semibold text-gold">{streak}</span>
            </div>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-2 rounded-lg hover:bg-surface-raised text-ink-2 hover:text-ink transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </header>
  )
}
