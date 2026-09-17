import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { fetchSkillsPath } from '../lib/skills-path'
import type { SkillPrinciple } from '../lib/skills-path'

// Color a concept's accuracy pill on the same thresholds the Stats page uses.
function accuracyBadge(pct: number): string {
  if (pct >= 75) return 'bg-success/15 text-success'
  if (pct >= 50) return 'bg-warning/15 text-warning'
  return 'bg-error/15 text-error'
}

export function SkillsPathPage(): JSX.Element {
  const [principles, setPrinciples] = useState<SkillPrinciple[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchSkillsPath()
      .then(setPrinciples)
      .catch(() => setError(true))
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-2">Skills Path</h1>
        <p className="text-lg text-ink-2">
          The five Controlled Chaos principles. Everything is unlocked, so train in any order.
        </p>
      </div>

      {error && (
        <p className="text-sm text-error">Could not load the skills path. Please try again.</p>
      )}

      {!error && principles === null && <p className="text-ink-3 text-sm">Loading…</p>}

      {principles && principles.length > 0 && (
        <div className="space-y-4">
          {principles.map((p, i) => {
            const practiced = p.concepts.filter((c) => c.attempts > 0).length
            return (
              <div key={p.slug} className="card space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gold flex items-center justify-center shrink-0">
                    <span className="text-on-gold font-bold">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-ink leading-tight">{p.name}</h2>
                    <p className="text-xs text-ink-3">
                      {practiced} of {p.concepts.length} concept{p.concepts.length !== 1 ? 's' : ''} practiced
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {p.concepts.map((c) => (
                    <div
                      key={c.slug}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl bg-surface-overlay border border-line"
                    >
                      <span className="text-sm font-medium text-ink truncate">{c.name}</span>
                      {c.accuracy !== null ? (
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${accuracyBadge(c.accuracy)}`}>
                          {c.accuracy}%
                        </span>
                      ) : (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-medium bg-surface text-ink-3">
                          Not started
                        </span>
                      )}
                    </div>
                  ))}
                  {p.concepts.length === 0 && <p className="text-sm text-ink-3">No concepts yet.</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {principles && principles.length === 0 && (
        <p className="text-ink-3 text-sm">The skills path is not set up yet.</p>
      )}
    </div>
  )
}
