import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { supabaseProd } from '../lib/supabase-prod'

import { ContentBody } from './ContentBody'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'loaded'; content: unknown }
  | { kind: 'error'; message: string }

type StagingContentProps = {
  contentId: string
  contentType: string
  refreshSignal: number
}

// The staging copy of a piece of content, fetched through get-from-staging (the
// frontend can't read the staging DB directly). Shown alongside the production
// panel so the author can see what's staged vs what's live.
export function StagingContent({
  contentId,
  contentType,
  refreshSignal,
}: StagingContentProps): JSX.Element {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    async function fetchStaged(): Promise<void> {
      setState({ kind: 'loading' })
      const { data, error } = await supabaseProd.functions.invoke('get-from-staging', {
        body: { content_id: contentId, content_type: contentType },
      })

      if (cancelled) return
      if (error) {
        setState({ kind: 'error', message: error.message })
        return
      }
      const result = data as { ok: boolean; content?: unknown; message?: string }
      if (!result.ok) {
        setState({ kind: 'error', message: result.message ?? 'Unknown error' })
        return
      }
      if (result.content === undefined || result.content === null) {
        setState({ kind: 'empty' })
        return
      }
      setState({ kind: 'loaded', content: result.content })
    }

    fetchStaged()
    return () => {
      cancelled = true
    }
  }, [contentId, contentType, refreshSignal])

  return (
    <section className="space-y-3" aria-live="polite">
      <h2 className="text-lg font-semibold">Staging</h2>
      {state.kind === 'loading' ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : state.kind === 'error' ? (
        <p className="text-sm text-red-400">
          Failed to load staging content: {state.message}
        </p>
      ) : state.kind === 'empty' ? (
        <p className="text-sm text-slate-400">Not in staging.</p>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto pr-1">
          <ContentBody content={state.content} contentType={contentType} />
        </div>
      )}
    </section>
  )
}
