import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

import {
  REFERENCE_CATEGORY_LABEL,
  fetchReferenceCategoryOrder,
  saveReferenceCategoryOrder,
} from '../lib/reference-sections'

export function ReferenceSectionOrder(): JSX.Element {
  const [order, setOrder] = useState<string[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReferenceCategoryOrder().then(setOrder).catch(() => setOrder(null))
  }, [])

  async function move(index: number, delta: number): Promise<void> {
    if (!order || saving) return
    const target = index + delta
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[index], next[target]] = [next[target], next[index]]
    const previous = order
    setOrder(next)
    setSaving(true)
    setError(null)
    try {
      await saveReferenceCategoryOrder(next)
    } catch (e) {
      setOrder(previous)
      setError(e instanceof Error ? e.message : 'Save failed')
    }
    setSaving(false)
  }

  if (!order) return <></>

  return (
    <div className="rounded border border-line p-3 space-y-2 max-w-md">
      <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest">Library section order</p>
      <p className="text-xs text-ink-3">Top to bottom, as members see the sections. Changes apply immediately.</p>
      <ul className="space-y-1">
        {order.map((key, i) => (
          <li key={key} className="flex items-center justify-between gap-2 text-sm text-ink bg-surface rounded px-3 py-1.5">
            <span>{REFERENCE_CATEGORY_LABEL[key] ?? key}</span>
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => void move(i, -1)}
                disabled={i === 0 || saving}
                aria-label={`Move ${REFERENCE_CATEGORY_LABEL[key] ?? key} up`}
                className="p-1 rounded hover:bg-surface-raised text-ink-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void move(i, 1)}
                disabled={i === order.length - 1 || saving}
                aria-label={`Move ${REFERENCE_CATEGORY_LABEL[key] ?? key} down`}
                className="p-1 rounded hover:bg-surface-raised text-ink-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ArrowDown className="w-4 h-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {error !== null && <p className="text-xs text-red-400">Not saved: {error}</p>}
    </div>
  )
}
