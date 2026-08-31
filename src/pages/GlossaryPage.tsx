import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Search, X } from 'lucide-react'

import type { GlossaryEntry } from '../../shared/schemas/glossary'
import { fetchAllGlossaryEntries } from '../lib/glossary'

const IMPORTANCE_LABELS: Record<string, string> = {
  core:        'Core',
  useful:      'Useful',
  situational: 'Situational',
}

const FILTERS = ['All', 'Core', 'Useful', 'Situational']

function TermDrawer({ term, onClose }: { term: GlossaryEntry; onClose: () => void }): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center px-3 lg:items-center lg:px-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full bg-surface-overlay rounded-3xl shadow-overlay animate-slide-up lg:max-w-lg lg:bg-surface lg:border lg:border-line lg:max-h-[90vh] lg:overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            {term.importance ? (
              <span className="badge-muted">{IMPORTANCE_LABELS[term.importance]}</span>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-surface-raised text-ink-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <h2 className="text-2xl font-bold text-ink mb-4">{term.term}</h2>
          <p className="text-lg text-ink-2 leading-relaxed">{term.definition}</p>

          {term.example && (
            <div className="mt-4 p-4 rounded-xl bg-surface-overlay border border-line">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-1">Example</p>
              <p className="text-sm text-ink-2 leading-relaxed">{term.example}</p>
            </div>
          )}

          {term.usage && (
            <div className="mt-3 p-4 rounded-xl bg-surface-overlay border border-line">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-1">Usage</p>
              <p className="text-sm text-ink-2 leading-relaxed">{term.usage}</p>
            </div>
          )}

          {term.related_terms && term.related_terms.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-2">Related Terms</p>
              <div className="flex flex-wrap gap-2">
                {term.related_terms.map((t) => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-full text-sm font-medium text-ink-2 border border-line bg-canvas"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button type="button" onClick={onClose} className="btn-primary w-full mt-6">
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}

export function GlossaryPage(): JSX.Element {
  const [entries, setEntries] = useState<GlossaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [selected, setSelected] = useState<GlossaryEntry | null>(null)

  useEffect(() => {
    fetchAllGlossaryEntries()
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = entries.filter((e) => {
    const matchesSearch =
      e.term.toLowerCase().includes(search.toLowerCase()) ||
      e.definition.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      activeFilter === 'All' || e.importance === activeFilter.toLowerCase()
    return matchesSearch && matchesFilter
  })

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-2">Glossary</h1>
        <p className="text-lg text-ink-2">Tap any term to see its definition</p>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search terms…"
          className="input pl-12"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActiveFilter(f)}
            className={activeFilter === f ? 'chip-active' : 'chip-inactive'}
          >
            {f}
          </button>
        ))}
      </div>

      {loading && <p className="text-ink-3 text-sm">Loading…</p>}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-lg text-ink-2">No terms found</p>
          <p className="text-sm text-ink-3 mt-1">Try a different search or filter</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((entry) => (
          <button
            key={entry.term_id ?? entry.term}
            type="button"
            onClick={() => setSelected(entry)}
            className="card flex flex-col items-start text-left hover:bg-surface-overlay transition-colors"
          >
            <div className="flex items-center justify-between w-full mb-2">
              <h3 className="text-lg font-semibold text-ink">{entry.term}</h3>
              {entry.importance && (
                <span className="badge-muted shrink-0">{IMPORTANCE_LABELS[entry.importance]}</span>
              )}
            </div>
            <p className="text-ink-2 text-sm line-clamp-2">{entry.definition}</p>
          </button>
        ))}
      </div>

      {selected && <TermDrawer term={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
