import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabaseProd } from '../lib/supabase-prod'
import { downloadJson, exportFilename } from '../lib/download'
import { ConfirmDialog } from './ConfirmDialog'
import type { ContentType } from '../../shared/schemas/content'

type StagedItem = {
  content_id: string
  content_type: ContentType
  content: unknown
  updated_at: string
}

type LoadState =
  { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'loaded'; items: StagedItem[] }

// Per-item promote status, keyed by `${type}:${id}`.
type PromoteStatus = 'idle' | 'promoting' | { version: number } | { error: string }
// Per-item delete status, keyed the same way.
type DeleteStatus = 'deleting' | { error: string }

// Content types this build exposes, mapped to their editor route. The Staging
// list only shows these types (others stay hidden, e.g. unreleased types on M1),
// and each gets an Edit button to its route.
const EDITOR_ROUTE: Partial<Record<ContentType, string>> = {
  lesson:    '/admin/wizard',
  glossary:  '/admin?tab=glossary',
  tip:       '/admin?tab=tip',
  reference: '/admin?tab=reference',
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

const TAB_TYPES: ContentType[] = ['lesson', 'reference', 'tip', 'glossary']

export function StagingBrowser(): JSX.Element {
  const navigate = useNavigate()
  const [state, setState] = useState<LoadState>({ kind: 'loading' })
  const [promote, setPromote] = useState<Record<string, PromoteStatus>>({})
  const [deleteState, setDeleteState] = useState<Record<string, DeleteStatus>>({})
  const [confirmItem, setConfirmItem] = useState<StagedItem | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [promotingAll, setPromotingAll] = useState(false)
  const [activeTab, setActiveTab] = useState<ContentType>('lesson')
  // Bumped to trigger a reload of the staging list (mount + Refresh button).
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function fetchStaged(): Promise<void> {
      setState({ kind: 'loading' })
      const { data, error } = await supabaseProd.functions.invoke('list-from-staging', {
        body: {},
      })
      if (cancelled) return
      if (error) {
        setState({ kind: 'error', message: error.message })
        return
      }
      const result = data as { ok: boolean; items?: StagedItem[]; message?: string }
      if (!result.ok) {
        setState({ kind: 'error', message: result.message ?? 'Unknown error' })
        return
      }
      setState({ kind: 'loaded', items: result.items ?? [] })
    }

    void fetchStaged()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function promoteItem(item: StagedItem): Promise<boolean> {
    setPromote((p) => ({ ...p, [key(item)]: 'promoting' }))
    const { data, error } = await supabaseProd.functions.invoke('promote-to-prod', {
      body: { content_id: item.content_id, content_type: item.content_type },
    })
    if (error) {
      setPromote((p) => ({ ...p, [key(item)]: { error: error.message } }))
      return false
    }
    const result = data as { ok: true; version_number: number } | { ok: false; message: string }
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
    // Discard any in-progress new-lesson draft - editing an existing item supersedes it
    try { sessionStorage.removeItem('bss_wizard_draft') } catch { /* ignore */ }
    navigate(route, { state: { preloadContent: item.content } })
  }

  // Full delete (staging + production) after the user confirms in the dialog.
  async function deleteItem(item: StagedItem): Promise<void> {
    setConfirmItem(null)
    setDeleteState((s) => ({ ...s, [key(item)]: 'deleting' }))
    const { data, error } = await supabaseProd.functions.invoke('delete-content', {
      body: { content_id: item.content_id, content_type: item.content_type },
    })
    if (error) {
      setDeleteState((s) => ({ ...s, [key(item)]: { error: error.message } }))
      return
    }
    const result = data as { ok: boolean; message?: string }
    if (!result.ok) {
      setDeleteState((s) => ({ ...s, [key(item)]: { error: result.message ?? 'Delete failed' } }))
      return
    }
    // Drop it from the list; the version history stays in the DB.
    setState((prev) =>
      prev.kind === 'loaded'
        ? { kind: 'loaded', items: prev.items.filter((i) => key(i) !== key(item)) }
        : prev,
    )
  }

  function deleteMessage(item: StagedItem): string {
    const base = `This permanently deletes "${labelFor(item)}" from BOTH staging and production. The version history is kept, but this cannot be undone.`
    return item.content_type === 'glossary'
      ? `${base} Lessons that reference this term will be updated to stop linking it.`
      : base
  }

  // Build per-type item counts from loaded state (for tab badges).
  const countByType: Partial<Record<ContentType, number>> =
    state.kind === 'loaded'
      ? state.items.reduce<Partial<Record<ContentType, number>>>((acc, item) => {
          if (EDITOR_ROUTE[item.content_type]) {
            acc[item.content_type] = (acc[item.content_type] ?? 0) + 1
          }
          return acc
        }, {})
      : {}

  const tabItems =
    state.kind === 'loaded'
      ? state.items.filter((item) => item.content_type === activeTab && EDITOR_ROUTE[item.content_type])
      : []

  const allVisibleItems =
    state.kind === 'loaded'
      ? state.items.filter((item) => EDITOR_ROUTE[item.content_type])
      : []

  return (
    <section className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Staging</h1>
          <p className="text-ink-2">
            Everything saved to staging but not necessarily promoted. Promote items to production,
            or open one in its editor to make changes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="px-3 py-1.5 text-sm rounded bg-surface-raised hover:bg-surface-overlay text-ink"
        >
          Refresh
        </button>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-line">
        {TAB_TYPES.map((type) => {
          const count = countByType[type] ?? 0
          return (
            <button
              key={type}
              type="button"
              onClick={() => setActiveTab(type)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px capitalize flex items-center gap-1.5 ${
                activeTab === type
                  ? 'text-gold border-gold'
                  : 'text-ink-3 border-transparent hover:text-ink'
              }`}
            >
              {type}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === type ? 'bg-gold/20 text-gold' : 'bg-surface-raised text-ink-3'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Body */}
      {state.kind === 'loading' && <p className="text-sm text-ink-2">Loading staged content…</p>}
      {state.kind === 'error' && <p className="text-sm text-red-400">Failed to load staging: {state.message}</p>}

      {state.kind === 'loaded' && (
        <div className="space-y-4">
          {allVisibleItems.length > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void promoteAll(allVisibleItems)}
                disabled={promotingAll}
                className="px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {promotingAll ? 'Promoting all…' : `Promote all ${allVisibleItems.length} to Production`}
              </button>
              <span className="text-sm text-ink-3">
                {TAB_TYPES.filter((t) => countByType[t]).map((t) => `${countByType[t]} ${t}`).join(' · ')}
              </span>
            </div>
          )}

          {tabItems.length === 0 ? (
            <p className="text-sm text-ink-2">No {activeTab} items in staging.</p>
          ) : (
            <ul className="rounded border border-line bg-canvas divide-y divide-line">
              {tabItems.map((item) => {
                const status = promote[key(item)] ?? 'idle'
                const del = deleteState[key(item)]
                const isOpen = expanded[key(item)] === true
                return (
                  <li key={key(item)} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-ink truncate">{labelFor(item)}</div>
                        <div className="text-xs text-ink-3">
                          <span className="font-mono">{item.content_id}</span>
                          <span> · {formatRelative(item.updated_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setExpanded((e) => ({ ...e, [key(item)]: !isOpen }))}
                          className="text-xs px-2 py-1 rounded bg-surface hover:bg-surface-raised text-ink-2"
                        >
                          {isOpen ? 'Hide' : 'View'}
                        </button>
                        {EDITOR_ROUTE[item.content_type] ? (
                          <button
                            type="button"
                            onClick={() => editItem(item)}
                            className="text-xs px-2 py-1 rounded bg-surface-raised hover:bg-surface-overlay text-ink"
                          >
                            Edit
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() =>
                            downloadJson(
                              exportFilename(item.content_type, item.content_id),
                              item.content,
                            )
                          }
                          className="text-xs px-2 py-1 rounded bg-surface hover:bg-surface-raised text-ink-2"
                        >
                          Export
                        </button>
                        <button
                          type="button"
                          onClick={() => void promoteItem(item)}
                          disabled={status === 'promoting' || promotingAll}
                          className="text-xs px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {status === 'promoting' ? 'Promoting…' : 'Promote'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmItem(item)}
                          disabled={deleteState[key(item)] === 'deleting'}
                          className="text-xs px-2 py-1 rounded bg-red-800 hover:bg-red-700 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {deleteState[key(item)] === 'deleting' ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </div>

                    {typeof status === 'object' && 'version' in status ? (
                      <p className="text-xs text-green-400">Promoted as v{status.version}</p>
                    ) : null}
                    {typeof status === 'object' && 'error' in status ? (
                      <p className="text-xs text-red-400">Promote failed: {status.error}</p>
                    ) : null}
                    {typeof del === 'object' && 'error' in del ? (
                      <p className="text-xs text-red-400">Delete failed: {del.error}</p>
                    ) : null}

                    {isOpen ? (
                      <pre className="text-xs text-ink-2 bg-canvas border border-line rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(item.content, null, 2)}
                      </pre>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmItem !== null}
        title="Delete content?"
        message={confirmItem ? deleteMessage(confirmItem) : ''}
        confirmLabel="Delete everywhere"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          if (confirmItem) void deleteItem(confirmItem)
        }}
        onCancel={() => setConfirmItem(null)}
      />
    </section>
  )
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  const diff = Math.max(0, (Date.now() - t) / 1000)
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
