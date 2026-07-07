import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import type { Tip } from '../../shared/schemas/tip'
import { fetchAllPublishedTips } from '../lib/tips'
import { fetchSavedTipIds, unsaveTip } from '../lib/saved-tips'

export function SavedTipsPage(): JSX.Element {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load(): Promise<void> {
      const ids = await fetchSavedTipIds()
      if (ids.length === 0) { setTips([]); return }
      const all = await fetchAllPublishedTips()
      const tipMap = new Map(all.map((t) => [t.tip_id, t]))
      setTips(ids.flatMap((id) => (tipMap.has(id) ? [tipMap.get(id)!] : [])))
    }
    load().catch(() => { setTips([]) }).finally(() => setLoading(false))
  }, [])

  function handleRemove(tipId: string | undefined): void {
    if (!tipId) return
    setTips((prev) => prev.filter((t) => t.tip_id !== tipId))
    unsaveTip(tipId).catch(() => {})
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Saved Tips</h1>
        <p className="text-sm text-zinc-500 mt-1">Tips you saved for later reference.</p>
      </div>

      {loading && <p className="text-zinc-500 text-sm">Loading…</p>}

      {!loading && tips.length === 0 && (
        <div className="card text-center space-y-2">
          <p className="text-zinc-100 font-medium">No saved tips yet</p>
          <p className="text-sm text-zinc-500">
            Tap "Save" on Today's Tip to keep it here for later reference.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {tips.map((tip) => (
          <div key={tip.tip_id} className="card space-y-2">
            <div className="flex items-start justify-between gap-3">
              {tip.concept
                ? <p className="text-xs text-zinc-500 font-medium">{tip.concept}</p>
                : <span />
              }
              <button
                type="button"
                onClick={() => handleRemove(tip.tip_id)}
                className="text-xs text-zinc-500 hover:text-error shrink-0 transition-colors"
              >
                Remove
              </button>
            </div>
            <p className="text-sm text-zinc-100 leading-relaxed">{tip.body}</p>
            {tip.principle_tag && (
              <p className="text-xs text-zinc-500">#{tip.principle_tag}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
