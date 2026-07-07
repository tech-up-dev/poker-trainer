import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { ChevronDown, ChevronUp } from 'lucide-react'

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
    <div className="card p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left gap-3 hover:bg-surface-overlay transition-colors"
      >
        <span className="text-sm font-semibold text-zinc-100">{entry.title}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-zinc-500 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
        }
      </button>

      {open && (
        <div className="border-t border-zinc-700 px-5 py-4">
          <div
            className="prose-reference"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {entry.tags.map((tag) => (
                <span key={tag} className="badge-muted text-xs">
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
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-zinc-100">References</h1>
        <p className="text-sm text-zinc-500 mt-1">Cheat sheets and methodology guides.</p>
      </div>

      {loading && <p className="text-zinc-500 text-sm">Loading…</p>}

      {!loading && references.length === 0 && (
        <div className="card text-center space-y-2">
          <p className="text-zinc-100 font-medium">No references published yet</p>
          <p className="text-sm text-zinc-500">
            The client can add cheat sheets and methodology guides via the CMS.
          </p>
        </div>
      )}

      {orderedKeys.map((key) => (
        <div key={key} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-500">
            {CATEGORY_LABEL[key] ?? 'General'}
          </h2>
          {grouped.get(key)!.map((ref) => (
            <ReferenceCard key={ref.reference_id ?? ref.title} entry={ref} />
          ))}
        </div>
      ))}
    </div>
  )
}
