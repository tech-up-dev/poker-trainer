import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabaseProd } from '../lib/supabase-prod'
import type { ContentType } from '../../shared/schemas/content'

type StagedItem = {
  content_id: string
  content_type: ContentType
  content: unknown
  updated_at: string
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; items: StagedItem[] }

// Per-item promote status, keyed by `${type}:${id}`.
type PromoteStatus = 'idle' | 'promoting' | { version: number } | { error: string }

// Content types this build exposes, mapped to their editor route. The Staging
// list only shows these types (others stay hidden — e.g. unreleased types on M1),
// and each gets an Edit button to its route.
const EDITOR_ROUTE: Partial<Record<ContentType, string>> = {
  lesson: '/admin',
  glossary: '/admin/glossary',
}

function key(item: StagedItem): string {
  return `${item.content_type}:${item.content_id}`
}

// Human-readable label for a staged item, by type. Falls back to the id when the
// expected field is missing. Tips have no title, so we show the tip body.
function labelFor(item: StagedItem): string {
  const c = item.content
  if (c === null || typeof c !== 'object') return item.content_id
  const pick = (field: string): string | undefined => {
    const v = (c as Record<string, unknown>)[field]
    return typeof v === 'string' && v.length > 0 ? v : undefined
  }
  switch (item.content_type) {
    case 'lesson':
    case 'reference':
      return pick('title') ?? item.content_id
    case 'glossary':
      return pick('term') ?? item.content_id
    case 'tip': {
      const body = pick('body')
      if (body) return body.length > 80 ? `${body.slice(0, 80)}…` : body
      return pick('concept') ?? item.content_id
    }
    default:
      return item.content_id
  }
}

export function StagingBrowser(): JSX.Element {
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [promote, setPromote] = useState<Record<string, PromoteStatus>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [promotingAll, setPromotingAll] = useState(false)

  // Returns the next LoadState without calling setState — lets callers
  // set state in a .then() callback, which satisfies react-hooks/set-state-in-effect.
  const load = useCallback((): Promise<LoadState> => {
    return supabaseProd.functions
      .invoke('list-from-staging', { body: {} })
      .then(({ data, error }) => {
        if (error) return { kind: 'error' as const, message: error.message }
        const result = data as { ok: boolean; items?: StagedItem[]; message?: string }
        if (!result.ok)
          return { kind: 'error' as const, message: result.message ?? 'Unknown error' }
        return { kind: 'loaded' as const, items: result.items ?? [] }
      })
  }, [])

  useEffect(() => {
    load().then(setState).catch((e: unknown) =>
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    )
  }, [load])

  async function promoteItem(item: StagedItem): Promise<boolean> {
    setPromote((p) => ({ ...p, [key(item)]: 'promoting' }))
    const { data, error } = await supabaseProd.functions.invoke('promote-to-prod', {
      body: { content_id: item.content_id, content_type: item.content_type },
    })
    if (error) {
      setPromote((p) => ({ ...p, [key(item)]: { error: error.message } }))
      return false
    }
    const result = data as
      | { ok: true; version_number: number }
      | { ok: false; message: string }
    if (!result.ok) {
      setPromote((p) => ({ ...p, [key(item)]: { error: result.message } }))
      return false
    }
    setPromote((p) => ({ ...p, [key(item)]: { version: result.version_number } }))
    return true
  }

  async function promoteAll(items: StagedItem[]): Promise<void> {
    if (promotingAll) return
    setPromotingAll(true)
    for (const item of items) {
      await promoteItem(item)
    }
    setPromotingAll(false)
  }

  function editItem(item: StagedItem): void {
    const route = EDITOR_ROUTE[item.content_type]
    if (!route) return
    navigate(route, { state: { preloadContent: item.content } })
  }

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Staging</h1>
          <p className="text-slate-400">
            Everything saved to staging but not necessarily promoted. Promote items
            to production, or open one in its editor to make changes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setState({ kind: 'loading' }); void load().then(setState) }}
          className="px-3 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
        >
          Refresh
        </button>
      </header>

      {renderBody()}
    </section>
  )

  function renderBody(): JSX.Element {
    if (state.kind === 'loading') {
      return <p className="text-sm text-slate-400">Loading staged content…</p>
    }
    if (state.kind === 'error') {
      return (
        <p className="text-sm text-red-400">Failed to load staging: {state.message}</p>
      )
    }
    // Only surface content types this build exposes (have an editor route). On
    // M1 that's lesson + glossary, so tips/references staged by later builds stay
    // hidden — the client shouldn't see types that aren't released yet.
    const visibleItems = state.items.filter((item) => EDITOR_ROUTE[item.content_type])

    if (visibleItems.length === 0) {
      return <p className="text-sm text-slate-400">Nothing in staging.</p>
    }

    const groups = new Map<ContentType, StagedItem[]>()
    for (const item of visibleItems) {
      const list = groups.get(item.content_type) ?? []
      list.push(item)
      groups.set(item.content_type, list)
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void promoteAll(visibleItems)}
            disabled={promotingAll}
            className="px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {promotingAll ? 'Promoting all…' : `Promote all ${visibleItems.length} to Production`}
          </button>
          <span className="text-sm text-slate-500">
            {[...groups.entries()].map(([t, l]) => `${l.length} ${t}`).join(' · ')}
          </span>
        </div>

        {[...groups.entries()].map(([type, items]) => (
          <div key={type} className="space-y-2">
            <h2 className="text-lg font-semibold capitalize">{type}</h2>
            <ul className="rounded border border-slate-700 bg-slate-950 divide-y divide-slate-800">
              {items.map((item) => {
                const status = promote[key(item)] ?? 'idle'
                const isOpen = expanded[key(item)] === true
                return (
                  <li key={key(item)} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-slate-100 truncate">{labelFor(item)}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono">{item.content_id}</span>
                          <span> · {formatRelative(item.updated_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setExpanded((e) => ({ ...e, [key(item)]: !isOpen }))
                          }
                          className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                        >
                          {isOpen ? 'Hide' : 'View'}
                        </button>
                        {EDITOR_ROUTE[item.content_type] ? (
                          <button
                            type="button"
                            onClick={() => editItem(item)}
                            className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
                          >
                            Edit
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void promoteItem(item)}
                          disabled={status === 'promoting' || promotingAll}
                          className="text-xs px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {status === 'promoting' ? 'Promoting…' : 'Promote'}
                        </button>
                      </div>
                    </div>

                    {typeof status === 'object' && 'version' in status ? (
                      <p className="text-xs text-green-400">Promoted as v{status.version}</p>
                    ) : null}
                    {typeof status === 'object' && 'error' in status ? (
                      <p className="text-xs text-red-400">Promote failed: {status.error}</p>
                    ) : null}

                    {isOpen ? (
                      <pre className="text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(item.content, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    )
  }
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Math.max(0, (Date.now() - t) / 1000)
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
