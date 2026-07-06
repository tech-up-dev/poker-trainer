import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { fetchStreak } from '../lib/streak'
import type { StreakResult } from '../lib/streak'

export function StreakBadge(): JSX.Element {
  const [streak, setStreak] = useState<StreakResult | null>(null)

  useEffect(() => {
    fetchStreak()
      .then(setStreak)
      .catch(() => {
        // Best-effort — streak display degrades gracefully.
      })
  }, [])

  if (!streak || streak.current === 0) return <></>

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/15 border border-gold/30">
      <span aria-hidden="true" className="text-base leading-none">🔥</span>
      <span className="text-sm font-semibold text-gold">
        {streak.current} day{streak.current !== 1 ? 's' : ''}
      </span>
    </div>
  )
}
