import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

import type { Reference } from '../../shared/schemas/reference'
import { fetchAllPublishedReferences } from '../lib/references'

const CATEGORY_LABEL: Record<string, string> = {
  cheat_sheet: 'Cheat Sheets',
  character_mapping: 'Character Mapping',
  methodology: 'Methodology',
}

const CATEGORY_ORDER = ['cheat_sheet', 'character_mapping', 'methodology']

function renderMarkdown(md: string): string {
  const raw = marked.parse(md, { async: false }) as string
  return DOMPurify.sanitize(raw)
}

function ReferenceCard({ entry }: { entry: Reference }): JSX.Element {
  const [open, setOpen] = useState(false)
  const html = open ? renderMarkdown(entry.body_markdown) : ''

  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left gap-3"
      >
        <span className="text-sm font-semibold text-ink">{entry.title}</span>
        <span className="text-ink-3 text-xs shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-line px-4 py-4">
          <div
            className="prose-reference"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-elevated text-ink-3 border border-line"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ReferencesLibraryPage(): JSX.Element {
  const navigate = useNavigate()
  const [references, setReferences] = useState<Reference[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAllPublishedReferences()
      .then(setReferences)
      .catch(() => setReferences([]))
      .finally(() => setLoading(false))
  }, [])

  const grouped = new Map<string, Reference[]>()
  for (const ref of references) {
    const key = ref.category ?? 'other'
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(ref)
  }

  const orderedKeys = [
    ...CATEGORY_ORDER.filter((k) => grouped.has(k)),
    ...(grouped.has('other') ? ['other'] : []),
  ]

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
          <h1 className="text-lg font-semibold">References</h1>
        </div>

        {loading && <p className="text-ink-2 text-sm">Loading…</p>}

        {!loading && references.length === 0 && (
          <div className="bg-surface border border-line rounded-xl p-6 text-center space-y-2">
            <p className="text-ink font-medium">No references published yet</p>
            <p className="text-sm text-ink-2">
              The client can add cheat sheets and methodology guides via the CMS.
            </p>
          </div>
        )}

        {orderedKeys.map((key) => (
          <div key={key} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gold">
              {CATEGORY_LABEL[key] ?? 'General'}
            </h2>
            {grouped.get(key)!.map((ref) => (
              <ReferenceCard key={ref.reference_id ?? ref.title} entry={ref} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
