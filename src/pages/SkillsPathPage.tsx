import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { fetchSkillsPath } from '../lib/skills-path'
import type { SkillPrinciple, SkillConcept } from '../lib/skills-path'

function accuracyColor(pct: number): string {
  if (pct >= 75) return 'bg-success/15 text-success'
  if (pct >= 50) return 'bg-warning/15 text-warning'
  return 'bg-error/15 text-error'
}

function principleProgress(p: SkillPrinciple): number {
  const practiced = p.concepts.filter((c) => c.attempts > 0)
  if (practiced.length === 0) return 0
  const avg = practiced.reduce((sum, c) => sum + (c.accuracy ?? 0), 0) / practiced.length
  return Math.round(avg)
}

function ConceptRow({ c }: { c: SkillConcept }): JSX.Element {
  return (
    <Link
      to={`/play/lessons?concept=${c.slug}`}
      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-overlay border border-line hover:border-gold/40 hover:bg-surface-raised transition-colors group"
    >
      <span className="text-sm font-medium text-ink truncate group-hover:text-gold transition-colors">
        {c.name}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        {c.accuracy !== null ? (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${accuracyColor(c.accuracy)}`}>
            {c.accuracy}%
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface text-ink-3">
            Not started
          </span>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-ink-3 group-hover:text-gold transition-colors" />
      </div>
    </Link>
  )
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
        <h1 className="text-2xl font-bold text-ink">Skills Path</h1>
        <p className="text-sm text-ink-2 mt-1">
          Five Controlled Chaos principles. Everything is unlocked - train in any order.
        </p>
      </div>

      {error && (
        <p className="text-sm text-error">Could not load the skills path. Please try again.</p>
      )}

      {!error && principles === null && <p className="text-ink-3 text-sm">Loading...</p>}

      {principles && principles.length > 0 && (
        <div className="space-y-4">
          {principles.map((p, i) => {
            const practiced = p.concepts.filter((c) => c.attempts > 0).length
            const avg = principleProgress(p)
            const barColor = avg >= 75 ? 'bg-success' : avg >= 50 ? 'bg-warning' : avg > 0 ? 'bg-error' : 'bg-surface-overlay'
            return (
              <div key={p.slug} className="card space-y-4">
                {/* Principle header */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-gold font-bold text-sm">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-ink leading-tight">{p.name}</h2>
                    <p className="text-xs text-ink-3 mt-0.5">
                      {practiced} of {p.concepts.length} concept{p.concepts.length !== 1 ? 's' : ''} practiced
                      {avg > 0 && <span className="ml-1">- {avg}% avg accuracy</span>}
                    </p>
                    {/* Progress bar */}
                    <div className="h-1 bg-elevated rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${avg}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Concept rows - each links to filtered lessons */}
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {p.concepts.map((c) => (
                    <ConceptRow key={c.slug} c={c} />
                  ))}
                  {p.concepts.length === 0 && (
                    <p className="text-sm text-ink-3">No concepts yet.</p>
                  )}
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
