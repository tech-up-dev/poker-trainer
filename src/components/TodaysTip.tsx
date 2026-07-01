import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import type { Tip } from '../../shared/schemas/tip'
import { fetchTodaysTip } from '../lib/tips'

export function TodaysTip(): JSX.Element {
  const [tip, setTip] = useState<Tip | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTodaysTip()
      .then(setTip)
      .catch(() => setTip(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-surface border border-line rounded-xl p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-2">
          Today's Tip
        </p>
        <p className="text-sm text-ink-2">Loading…</p>
      </div>
    )
  }

  if (!tip) return <></>

  return (
    <div className="bg-surface border border-line rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-gold">Today's Tip</p>
      {tip.concept && (
        <p className="text-xs text-ink-3 font-medium">{tip.concept}</p>
      )}
      <p className="text-sm text-ink leading-relaxed">{tip.body}</p>
      {tip.principle_tag && (
        <p className="text-xs text-ink-3">#{tip.principle_tag}</p>
      )}
    </div>
  )
}
