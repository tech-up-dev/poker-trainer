import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import type { Tip } from '../../shared/schemas/tip'
import { saveTip, unsaveTip } from '../lib/saved-tips'
import { fetchTodaysTip } from '../lib/tips'

export function TodaysTip(): JSX.Element {
  const [tip, setTip] = useState<Tip | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    fetchTodaysTip()
      .then(setTip)
      .catch(() => setTip(null))
      .finally(() => setLoading(false))
  }, [])

  function handleSave(): void {
    if (!tip?.tip_id) return
    const next = !isSaved
    setIsSaved(next)
    const op = next ? saveTip(tip.tip_id) : unsaveTip(tip.tip_id)
    op.catch(() => {})
  }

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
    <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-gold">Today's Tip</p>
        {tip.tip_id && (
          <button
            type="button"
            onClick={handleSave}
            className="text-xs font-medium shrink-0 transition-colors text-ink-3 hover:text-gold"
          >
            {isSaved ? 'Saved ✓' : 'Save'}
          </button>
        )}
      </div>
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
