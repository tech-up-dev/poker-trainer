import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { supabaseProd } from '../lib/supabase-prod'

import { ConfirmDialog } from './ConfirmDialog'
import { ContentBody } from './ContentBody'

type Version = {
  id: string
  content_id: string
  content_type: string
  version_number: number
  created_at: string
  created_by: string | null
  source_version: number | null
}

type RollbackStatus =
  | 'idle'
  | { running: number }
  | { done: { rolled_back_from: number; version_number: number } }
  | { error: string }

// The content captured at a specific version, shown read-only when the admin
// clicks Preview. Loads lazily from content_versions so the list stays cheap.
type PreviewState =
  | { kind: 'closed' }
  | { kind: 'loading'; version: number }
  | { kind: 'open'; version: number; content: unknown }
  | { kind: 'error'; version: number; message: string }

type VersionsPanelProps = {
  contentId: string
  contentType: string
  refreshSignal: number
  onAfterRollback?: (content: unknown) => void
}

export function VersionsPanel({
  contentId,
  contentType,
  refreshSignal,
  onAfterRollback,
}: VersionsPanelProps): JSX.Element {
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rollbackStatus, setRollbackStatus] = useState<RollbackStatus>('idle')
  const [confirmTarget, setConfirmTarget] = useState<number | null>(null)
  const [preview, setPreview] = useState<PreviewState>({ kind: 'closed' })

  useEffect(() => {
    let cancelled = false

    async function fetchVersions(): Promise<void> {
      setLoadError(null)
      setPreview({ kind: 'closed' })
      const { data, error } = await supabaseProd
        .from('content_versions')
        .select(
          'id, content_id, content_type, version_number, created_at, created_by, source_version',
        )
        .eq('content_id', contentId)
        .eq('content_type', contentType)
        .order('version_number', { ascending: false })

      if (cancelled) return
      if (error) {
        setLoadError(error.message)
        setVersions(null)
        return
      }
      setVersions(data as Version[])
    }

    fetchVersions()
    return () => {
      cancelled = true
    }
  }, [contentId, contentType, refreshSignal])

  function requestRollback(targetVersion: number): void {
    setConfirmTarget(targetVersion)
  }

  async function performRollback(): Promise<void> {
    const targetVersion = confirmTarget
    if (targetVersion === null) return
    setConfirmTarget(null)

    setRollbackStatus({ running: targetVersion })
    const { data, error } = await supabaseProd.functions.invoke('rollback-to-version', {
      body: { content_id: contentId, content_type: contentType, target_version: targetVersion },
    })

    if (error) {
      setRollbackStatus({ error: error.message })
      return
    }

    type RollbackOk = {
      ok: true
      content_id: string
      content_type: string
      version_number: number
      rolled_back_from: number
    }
    type RollbackErr = { ok: false; message: string }
    const result = data as RollbackOk | RollbackErr
    if (!result.ok) {
      setRollbackStatus({ error: result.message })
      return
    }

    setRollbackStatus({
      done: {
        rolled_back_from: result.rolled_back_from,
        version_number: result.version_number,
      },
    })

    const { data: pubData } = await supabaseProd
      .from('content_published')
      .select('content')
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .single()
    onAfterRollback?.(pubData?.content ?? null)
  }

  async function togglePreview(version: number): Promise<void> {
    // Clicking the open version's Preview again closes it.
    if (preview.kind !== 'closed' && preview.version === version) {
      setPreview({ kind: 'closed' })
      return
    }
    setPreview({ kind: 'loading', version })
    const { data, error } = await supabaseProd
      .from('content_versions')
      .select('content')
      .eq('content_id', contentId)
      .eq('content_type', contentType)
      .eq('version_number', version)
      .maybeSingle()

    if (error) {
      setPreview({ kind: 'error', version, message: error.message })
      return
    }
    if (!data) {
      setPreview({ kind: 'error', version, message: 'Version not found' })
      return
    }
    setPreview({ kind: 'open', version, content: data.content })
  }

  const rollbackInFlight = typeof rollbackStatus === 'object' && 'running' in rollbackStatus
  const openPreviewVersion = preview.kind !== 'closed' ? preview.version : null

  return (
    <section className="space-y-2" aria-live="polite">
      <h2 className="text-lg font-semibold">Versions</h2>
      {renderVersionsBody(
        versions,
        loadError,
        rollbackInFlight,
        requestRollback,
        (v) => void togglePreview(v),
        openPreviewVersion,
      )}
      {renderPreview(preview, contentType)}
      {renderRollbackStatus(rollbackStatus)}
      <ConfirmDialog
        open={confirmTarget !== null}
        title={confirmTarget !== null ? `Roll back to v${confirmTarget}?` : ''}
        message="A new production version will be appended with this content. Previous versions are preserved."
        confirmLabel="Roll back"
        cancelLabel="Cancel"
        destructive
        onConfirm={performRollback}
        onCancel={() => setConfirmTarget(null)}
      />
    </section>
  )
}

function renderVersionsBody(
  versions: Version[] | null,
  loadError: string | null,
  rollbackInFlight: boolean,
  onRollback: (v: number) => void,
  onPreview: (v: number) => void,
  openPreviewVersion: number | null,
): JSX.Element {
  if (loadError !== null) {
    return <p className="text-sm text-red-400">Failed to load versions: {loadError}</p>
  }
  if (versions === null) {
    return <p className="text-sm text-slate-400">Loading versions…</p>
  }
  if (versions.length === 0) {
    return <p className="text-sm text-slate-400">No production versions yet.</p>
  }

  const currentVersionNumber = versions[0].version_number

  return (
    <ul className="rounded border border-slate-700 bg-slate-950 divide-y divide-slate-800">
      {versions.map((v) => {
        const isCurrent = v.version_number === currentVersionNumber
        return (
          <li key={v.id} className="flex items-center justify-between px-4 py-2 text-sm">
            <div className="space-x-2">
              <span className="font-mono text-slate-200">v{v.version_number}</span>
              <span className="text-slate-500">
                · {formatRelative(v.created_at)} · {v.created_by ?? 'unknown'}
              </span>
              {v.source_version !== null ? (
                <span className="text-slate-500">(from v{v.source_version})</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onPreview(v.version_number)}
                className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                {openPreviewVersion === v.version_number ? 'Hide' : 'Preview'}
              </button>
              {isCurrent ? (
                <span className="text-xs text-green-400 px-2 py-0.5 rounded bg-green-600/10 border border-green-600/30">
                  current
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onRollback(v.version_number)}
                  disabled={rollbackInFlight}
                  className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Rollback
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function renderPreview(preview: PreviewState, contentType: string): JSX.Element | null {
  if (preview.kind === 'closed') return null
  if (preview.kind === 'loading') {
    return <p className="text-sm text-slate-400">Loading v{preview.version}…</p>
  }
  if (preview.kind === 'error') {
    return (
      <p className="text-sm text-red-400">
        Failed to load v{preview.version}: {preview.message}
      </p>
    )
  }
  return (
    <div className="space-y-2 rounded border border-slate-700 bg-slate-950 p-3">
      <div className="text-xs text-slate-400">Preview of v{preview.version}</div>
      <div className="max-h-[24rem] overflow-y-auto pr-1">
        <ContentBody content={preview.content} contentType={contentType} />
      </div>
    </div>
  )
}

function renderRollbackStatus(status: RollbackStatus): JSX.Element | null {
  if (status === 'idle') return null
  if ('running' in status) {
    return <p className="text-sm text-slate-400">Rolling back to v{status.running}…</p>
  }
  if ('done' in status) {
    return (
      <p className="text-sm text-green-400">
        Rolled back to v{status.done.rolled_back_from}; production now at v
        {status.done.version_number}
      </p>
    )
  }
  return <p className="text-sm text-red-400">Rollback failed: {status.error}</p>
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, (now - t) / 1000)
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
