import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'

import type { Tip } from '../../shared/schemas/tip'
import { fetchAllPublishedTips } from '../lib/tips'
import { fetchSavedTipIds, unsaveTip } from '../lib/saved-tips'

export function SavedTipsPage(): JSX.Element {
  const navigate = useNavigate()
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load(): Promise<void> {
      const ids = await fetchSavedTipIds()
      if (ids.length === 0) {
        setTips([])
        return
      }
      const all = await fetchAllPublishedTips()
      // Preserve saved order (newest first) by mapping ids in order
      const tipMap = new Map(all.map((t) => [t.tip_id, t]))
      setTips(ids.flatMap((id) => (tipMap.has(id) ? [tipMap.get(id)!] : [])))
    }

    load()
      .catch(() => setTips([]))
      .finally(() => setLoading(false))
  }, [])

  function handleRemove(tipId: string | undefined): void {
    if (!tipId) return
    setTips((prev) => prev.filter((t) => t.tip_id !== tipId))
    unsaveTip(tipId).catch(() => {})
  }

  return (
    <div className="min-h-screen bg-canvas text-ink px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/play')}
            className="text-sm text-link hover:underline"
          >
            ← Back
          </button>
          <h1 className="text-lg font-semibold">Saved Tips</h1>
        </div>

        {loading && <p className="text-ink-2 text-sm">Loading…</p>}

        {!loading && tips.length === 0 && (
          <div className="bg-surface border border-line rounded-xl p-6 text-center space-y-2">
            <p className="text-ink font-medium">No saved tips yet</p>
            <p className="text-sm text-ink-2">
              Tap "Save" on Today's Tip to keep it here for later reference.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {tips.map((tip) => (
            <div
              key={tip.tip_id}
              className="bg-surface border border-line rounded-xl p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                {tip.concept ? (
                  <p className="text-xs text-ink-3 font-medium">{tip.concept}</p>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(tip.tip_id)}
                  className="text-xs text-ink-3 hover:text-error shrink-0 transition-colors"
                >
                  Remove
                </button>
              </div>
              <p className="text-sm text-ink leading-relaxed">{tip.body}</p>
              {tip.principle_tag && (
                <p className="text-xs text-ink-3">#{tip.principle_tag}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
