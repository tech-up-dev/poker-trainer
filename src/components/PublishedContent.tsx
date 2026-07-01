import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { supabaseProd } from '../lib/supabase-prod'
import { downloadJson, exportFilename } from '../lib/download'

import { ContentBody } from './ContentBody'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; content: unknown }
  | { kind: 'error'; message: string }

type PublishedContentProps = {
  contentId: string
  contentType: string
  refreshSignal: number
}

// The production copy of a piece of content, read straight from content_published.
export function PublishedContent({
  contentId,
  contentType,
  refreshSignal,
}: PublishedContentProps): JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function fetchPublished(): Promise<void> {
      setState({ kind: 'loading' })
      const { data, error } = await supabaseProd
        .from('content_published')
        .select('content')
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .maybeSingle()

      if (cancelled) return
      if (error) {
        setState({ kind: 'error', message: error.message })
        return
      }
      if (data === null) {
        setState({ kind: 'empty' })
        return
      }
      setState({ kind: 'loaded', content: data.content })
    }

    fetchPublished()
    return () => {
      cancelled = true
    }
  }, [contentId, contentType, refreshSignal])

  return (
    <section className="space-y-3" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Production (Published)</h2>
        {state.kind === 'loaded' ? (
          <button
            type="button"
            onClick={() =>
              downloadJson(exportFilename(contentType, contentId), state.content)
            }
            className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            Export JSON
          </button>
        ) : null}
      </div>
      {state.kind === 'loading' ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : state.kind === 'error' ? (
        <p className="text-sm text-red-400">Failed to load published content: {state.message}</p>
      ) : state.kind === 'empty' ? (
        <p className="text-sm text-slate-400">No production version yet.</p>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto pr-1">
          <ContentBody content={state.content} contentType={contentType} />
        </div>
      )}
    </section>
  )
}
