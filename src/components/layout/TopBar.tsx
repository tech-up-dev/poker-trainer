import { Flame, Menu } from 'lucide-react'
import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import { fetchStreak } from '../../lib/streak'

interface TopBarProps {
  onMenuClick: () => void
}

export function TopBar({ onMenuClick }: TopBarProps): JSX.Element {
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    fetchStreak()
      .then((s) => setStreak(s.current))
      .catch(() => {})
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-[#18181b]/95 backdrop-blur-sm border-b border-zinc-800">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-surface-raised text-zinc-400 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <span className="text-sm font-bold text-zinc-900">B</span>
            </div>
          </div>
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-500/10 rounded-full">
            <Flame className="w-5 h-5 text-brand-500" />
            <span className="text-base font-semibold text-brand-500">{streak}</span>
          </div>
        )}
      </div>
    </header>
  )
}
