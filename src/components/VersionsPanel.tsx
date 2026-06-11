import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { supabaseProd } from '../lib/supabase-prod'

import { ConfirmDialog } from './ConfirmDialog'

type Version = {
  id: string
  lesson_id: string
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

type VersionsPanelProps = {
  lessonId: string
  refreshSignal: number
  onAfterRollback?: () => void
}

export function VersionsPanel({
  lessonId,
  refreshSignal,
  onAfterRollback,
}: VersionsPanelProps): JSX.Element {
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rollbackStatus, setRollbackStatus] = useState<RollbackStatus>('idle')
  const [confirmTarget, setConfirmTarget] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchVersions(): Promise<void> {
      setLoadError(null)
      const { data, error } = await supabaseProd
        .from('lesson_versions')
        .select(
          'id, lesson_id, version_number, created_at, created_by, source_version'
        )
        .eq('lesson_id', lessonId)
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
  }, [lessonId, refreshSignal])

  function requestRollback(targetVersion: number): void {
    setConfirmTarget(targetVersion)
  }

  async function performRollback(): Promise<void> {
    const targetVersion = confirmTarget
    if (targetVersion === null) return
    setConfirmTarget(null)

    setRollbackStatus({ running: targetVersion })
    const { data, error } = await supabaseProd.functions.invoke(
      'rollback-to-version',
      { body: { lesson_id: lessonId, target_version: targetVersion } }
    )

    if (error) {
      setRollbackStatus({ error: error.message })
      return
    }

    type RollbackOk = {
      ok: true
      lesson_id: string
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
    onAfterRollback?.()
  }

  const rollbackInFlight =
    typeof rollbackStatus === 'object' && 'running' in rollbackStatus

  return (
    <section className="space-y-2" aria-live="polite">
      <h2 className="text-lg font-semibold">Versions</h2>
      {renderVersionsBody(versions, loadError, rollbackInFlight, requestRollback)}
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
  onRollback: (v: number) => void
): JSX.Element {
  if (loadError !== null) {
    return (
      <p className="text-sm text-red-400">
        Failed to load versions: {loadError}
      </p>
    )
  }
  if (versions === null) {
    return <p className="text-sm text-slate-400">Loading versions…</p>
  }
  if (versions.length === 0) {
    return (
      <p className="text-sm text-slate-400">No production versions yet.</p>
    )
  }

  const currentVersionNumber = versions[0].version_number

  return (
    <ul className="rounded border border-slate-700 bg-slate-950 divide-y divide-slate-800">
      {versions.map((v) => {
        const isCurrent = v.version_number === currentVersionNumber
        return (
          <li
            key={v.id}
            className="flex items-center justify-between px-4 py-2 text-sm"
          >
            <div className="space-x-2">
              <span className="font-mono text-slate-200">v{v.version_number}</span>
              <span className="text-slate-500">
                · {formatRelative(v.created_at)} · {v.created_by ?? 'unknown'}
              </span>
              {v.source_version !== null ? (
                <span className="text-slate-500">(from v{v.source_version})</span>
              ) : null}
            </div>
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
          </li>
        )
      })}
    </ul>
  )
}

function renderRollbackStatus(status: RollbackStatus): JSX.Element | null {
  if (status === 'idle') return null
  if ('running' in status) {
    return (
      <p className="text-sm text-slate-400">
        Rolling back to v{status.running}…
      </p>
    )
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
