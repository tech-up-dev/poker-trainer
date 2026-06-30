import type { JSX } from 'react'

import { useTheme } from '../lib/theme'

// Brand-tokenized toggle. Lives on the canvas/surface/gold tokens so it
// repaints correctly in both themes without any conditional classes.
export function ThemeToggle(): JSX.Element {
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={isLight}
      className="px-3 py-1.5 rounded-full text-sm font-medium border border-line bg-surface text-ink hover:bg-elevated transition-colors"
    >
      {isLight ? '☀️ Light' : '🌙 Dark'}
    </button>
  )
}
