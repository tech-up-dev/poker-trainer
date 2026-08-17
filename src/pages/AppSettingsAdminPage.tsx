import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabaseProd } from '../lib/supabase-prod'

type Tier = { min_pct: number; message: string; confetti: boolean }

const DEFAULT_TIERS: Tier[] = [
  { min_pct: 90, message: 'Outstanding performance!',  confetti: true  },
  { min_pct: 70, message: 'Lesson complete!',           confetti: true  },
  { min_pct: 50, message: 'Good effort, keep going!',   confetti: false },
  { min_pct: 0,  message: 'Keep practicing',            confetti: false },
]

function tierLabel(idx: number, total: number): string {
  if (idx === 0) return 'Top tier'
  if (idx === total - 1) return 'Bottom tier'
  return `Tier ${idx + 1}`
}

export function AppSettingsAdminPage(): JSX.Element {
  const [tiers, setTiers] = useState<Tier[]>(DEFAULT_TIERS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Leak panel thresholds (M3-16)
  const [minAttempts, setMinAttempts] = useState(8)
  const [accuracyCeiling, setAccuracyCeiling] = useState(75)
  const [leakSaving, setLeakSaving] = useState(false)
  const [leakSaved, setLeakSaved] = useState(false)
  const [leakError, setLeakError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await supabaseProd
        .from('app_settings')
        .select('key,value')
        .in('key', ['lesson_result_tiers', 'leak_min_attempts', 'leak_accuracy_ceiling'])
      if (data) {
        for (const row of data) {
          if (row.key === 'lesson_result_tiers') {
            const rows = row.value as Tier[]
            if (Array.isArray(rows) && rows.length > 0) {
              setTiers([...rows].sort((a, b) => b.min_pct - a.min_pct))
            }
          } else if (row.key === 'leak_min_attempts') {
            setMinAttempts(Number(row.value))
          } else if (row.key === 'leak_accuracy_ceiling') {
            setAccuracyCeiling(Number(row.value))
          }
        }
      }
      setLoading(false)
    })()
  }, [])

  function updateTier<K extends keyof Tier>(idx: number, field: K, value: Tier[K]): void {
    setTiers((prev) => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))
    setSaved(false)
  }

  function addTier(): void {
    setTiers((prev) => {
      // Insert a new tier above the bottom tier with a midpoint threshold.
      const bottom = prev[prev.length - 1]
      const secondLast = prev[prev.length - 2]
      const newPct = secondLast ? Math.round((secondLast.min_pct + bottom.min_pct) / 2) : 25
      const next = [...prev]
      next.splice(prev.length - 1, 0, { min_pct: newPct, message: '', confetti: false })
      return next
    })
    setSaved(false)
  }

  function removeTier(idx: number): void {
    setTiers((prev) => prev.filter((_, i) => i !== idx))
    setSaved(false)
  }

  async function handleLeakSave(): Promise<void> {
    setLeakSaving(true)
    setLeakError(null)
    const updates = [
      supabaseProd.from('app_settings').update({ value: minAttempts }).eq('key', 'leak_min_attempts'),
      supabaseProd.from('app_settings').update({ value: accuracyCeiling }).eq('key', 'leak_accuracy_ceiling'),
    ]
    const results = await Promise.all(updates)
    const err = results.find((r) => r.error)?.error
    if (err) {
      setLeakError(err.message)
      setLeakSaving(false)
      return
    }
    setLeakSaved(true)
    setLeakSaving(false)
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    setError(null)
    const { error: err } = await supabaseProd
      .from('app_settings')
      .update({ value: tiers })
      .eq('key', 'lesson_result_tiers')
    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }
    setSaved(true)
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-ink-2">Loading settings…</p>

  return (
    <section className="space-y-6 max-w-2xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">App Settings</h1>
        <p className="text-ink-2">Configure lesson result thresholds, leak panel behaviour, and other admin-tunable values.</p>
      </header>

      <div className="rounded border border-line bg-canvas divide-y divide-line">
        <div className="px-4 py-2 bg-surface-raised grid grid-cols-[110px_96px_1fr_90px_32px] gap-3 text-xs font-semibold text-ink-3 uppercase tracking-wide">
          <span>Tier</span>
          <span>Min score</span>
          <span>Message</span>
          <span>Confetti</span>
          <span />
        </div>
        {tiers.map((tier, idx) => {
          const isBottom = idx === tiers.length - 1
          const canRemove = !isBottom && tiers.length > 2
          return (
            <div key={idx} className="px-4 py-3 grid grid-cols-[110px_96px_1fr_90px_32px] gap-3 items-center">
              <span className="text-sm text-ink-2">{tierLabel(idx, tiers.length)}</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={tier.min_pct}
                  onChange={(e) => updateTier(idx, 'min_pct', Number(e.target.value))}
                  disabled={isBottom}
                  className="w-14 px-2 py-1.5 text-sm rounded border border-line bg-canvas text-ink focus:outline-none focus:border-gold disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <span className="text-xs text-ink-3">%+</span>
              </div>
              <input
                type="text"
                value={tier.message}
                onChange={(e) => updateTier(idx, 'message', e.target.value)}
                className="px-3 py-1.5 text-sm rounded border border-line bg-canvas text-ink focus:outline-none focus:border-gold"
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={tier.confetti}
                  onChange={(e) => updateTier(idx, 'confetti', e.target.checked)}
                  className="w-4 h-4 accent-gold cursor-pointer"
                />
                <span className="text-xs text-ink-2">Confetti</span>
              </label>
              <button
                type="button"
                onClick={() => removeTier(idx)}
                disabled={!canRemove}
                title={isBottom ? 'Bottom tier cannot be removed' : tiers.length <= 2 ? 'Minimum 2 tiers required' : 'Remove tier'}
                className="p-1 rounded text-ink-3 hover:text-error hover:bg-error/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={addTier}
        className="flex items-center gap-2 px-4 py-2 rounded border border-line text-sm text-ink-2 hover:text-ink hover:bg-surface-raised transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add tier
      </button>

      <p className="text-xs text-ink-3">
        The bottom tier threshold is always 0% and cannot be changed. Tiers are evaluated highest-first - a score qualifies for the first tier whose minimum it meets.
      </p>

      {error && (
        <p className="text-sm text-error">
          Save failed: {error}. Ask the back-end developer to add a write policy for admin users on the <code>app_settings</code> table.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-5 py-2 rounded bg-gold text-on-gold font-semibold text-sm hover:bg-amber disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="text-sm text-success">Saved successfully.</span>}
      </div>
      {/* ── Leak panel thresholds (M3-16) ── */}
      <div className="border-t border-line pt-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">"Where you're leaking" panel</h2>
          <p className="text-sm text-ink-2">
            A concept appears in the leak panel only when both thresholds are met. Adjust after launch based on real usage.
          </p>
        </div>

        <div className="rounded border border-line bg-canvas divide-y divide-line">
          <div className="px-4 py-3 flex items-center gap-4">
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium text-ink">Minimum attempts</p>
              <p className="text-xs text-ink-3">A concept must have at least this many answer attempts before it can appear.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="number"
                min={1}
                max={100}
                value={minAttempts}
                onChange={(e) => { setMinAttempts(Number(e.target.value)); setLeakSaved(false) }}
                className="w-20 px-2 py-1.5 text-sm rounded border border-line bg-canvas text-ink focus:outline-none focus:border-gold text-right"
              />
              <span className="text-xs text-ink-3 w-16">attempts</span>
            </div>
          </div>

          <div className="px-4 py-3 flex items-center gap-4">
            <div className="flex-1 space-y-0.5">
              <p className="text-sm font-medium text-ink">Accuracy ceiling</p>
              <p className="text-xs text-ink-3">A concept only shows as a leak if the member's accuracy is below this percentage.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="number"
                min={1}
                max={99}
                value={accuracyCeiling}
                onChange={(e) => { setAccuracyCeiling(Number(e.target.value)); setLeakSaved(false) }}
                className="w-20 px-2 py-1.5 text-sm rounded border border-line bg-canvas text-ink focus:outline-none focus:border-gold text-right"
              />
              <span className="text-xs text-ink-3 w-16">% correct</span>
            </div>
          </div>
        </div>

        {leakError && <p className="text-sm text-error">{leakError}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void handleLeakSave()}
            disabled={leakSaving}
            className="px-5 py-2 rounded bg-gold text-on-gold font-semibold text-sm hover:bg-amber disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {leakSaving ? 'Saving…' : 'Save thresholds'}
          </button>
          {leakSaved && <span className="text-sm text-success">Saved successfully.</span>}
        </div>
      </div>
    </section>
  )
}
