import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import type { Tip } from '../../shared/schemas/tip'
import { supabaseProd } from '../lib/supabase-prod'
import { validateTip, type FieldError } from '../lib/validate'
import validSample from '../../samples/valid-tip.json'
import invalidSample from '../../samples/invalid-tip.json'
import { VersionsPanel } from './VersionsPanel'

type SingleValidation =
  | { ok: true; data: Tip }
  | { ok: false; errors: FieldError[] }
  | { ok: false; parseError: string }

type ItemValidation = { ok: true; data: Tip } | { ok: false; errors: FieldError[] }

type SaveStatus = 'idle' | 'saving' | 'saved' | { error: string }

type PromoteStatus = 'idle' | 'promoting' | { promoted: number } | { error: string }

type BatchSaveStatus =
  | 'idle'
  | 'saving'
  | { saved: number; failed: number; errors: string[] }

type TipEditorProps = {
  onPublishedContextChange: (ctx: {
    contentId: string | null
    contentType: string | null
    refreshSignal: number
  }) => void
  initialText?: string
}

export function TipEditor({ onPublishedContextChange, initialText }: TipEditorProps): JSX.Element {
  const [inputText, setInputText] = useState(initialText ?? '')

  // Single-item mode
  const [singleResult, setSingleResult] = useState<SingleValidation | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [promoteStatus, setPromoteStatus] = useState<PromoteStatus>('idle')
  const [versionsRefresh, setVersionsRefresh] = useState(0)
  const [savedId, setSavedId] = useState<string | null>(null)

  // Batch mode
  const [batchResults, setBatchResults] = useState<ItemValidation[] | null>(null)
  const [batchSaveStatus, setBatchSaveStatus] = useState<BatchSaveStatus>('idle')

  const isBatch = batchResults !== null
  const explicitId = singleResult?.ok === true ? (singleResult.data.tip_id ?? null) : null
  const effectiveId = explicitId ?? savedId

  useEffect(() => {
    onPublishedContextChange({
      contentId: isBatch ? null : effectiveId,
      contentType: isBatch ? null : effectiveId ? 'tip' : null,
      refreshSignal: versionsRefresh,
    })
  }, [effectiveId, versionsRefresh, onPublishedContextChange, isBatch])

  const canSave = singleResult?.ok === true
  const isSaving = saveStatus === 'saving'
  const isPromoting = promoteStatus === 'promoting'
  const operationInFlight = isSaving || isPromoting

  const allBatchValid = batchResults !== null && batchResults.length > 0 && batchResults.every((r) => r.ok)
  const isBatchSaving = batchSaveStatus === 'saving'

  function resetTransientState(): void {
    setSingleResult(null)
    setBatchResults(null)
    setSaveStatus('idle')
    setPromoteStatus('idle')
    setSavedId(null)
    setBatchSaveStatus('idle')
  }

  function loadSample(sample: unknown): void {
    setInputText(JSON.stringify(sample, null, 2))
    resetTransientState()
  }

  function handleTextChange(value: string): void {
    setInputText(value)
    resetTransientState()
  }

  function handleValidate(): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(inputText)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to parse JSON'
      setSingleResult({ ok: false, parseError: message })
      setBatchResults(null)
      setSaveStatus('idle')
      setPromoteStatus('idle')
      return
    }

    if (Array.isArray(parsed)) {
      const results: ItemValidation[] = parsed.map((item) => {
        const r = validateTip(item)
        if (r.ok) return { ok: true, data: r.data }
        return r
      })
      setBatchResults(results)
      setSingleResult(null)
      setBatchSaveStatus('idle')
    } else {
      setSingleResult(validateTip(parsed))
      setBatchResults(null)
      setSaveStatus('idle')
      setPromoteStatus('idle')
    }
  }

  async function handleSave(): Promise<void> {
    if (singleResult?.ok !== true) return
    if (saveStatus === 'saving') return
    const tip = singleResult.data
    setSaveStatus('saving')
    const { data, error } = await supabaseProd.functions.invoke('save-to-staging', {
      body: { content_id: tip.tip_id, content_type: 'tip', content: tip },
    })
    if (error) {
      setSaveStatus({ error: error.message })
      return
    }
    const result = data as { ok: boolean; content_id?: string; message?: string }
    if (!result.ok) setSaveStatus({ error: result.message ?? 'Unknown error' })
    else {
      setSaveStatus('saved')
      if (result.content_id) setSavedId(result.content_id)
      setVersionsRefresh((s) => s + 1)
    }
  }

  async function handleBatchSave(): Promise<void> {
    if (!batchResults || !allBatchValid) return
    if (isBatchSaving) return
    setBatchSaveStatus('saving')

    let saved = 0
    const errors: string[] = []

    for (const result of batchResults) {
      if (!result.ok) continue
      const tip = result.data
      const { data, error } = await supabaseProd.functions.invoke('save-to-staging', {
        body: { content_id: tip.tip_id, content_type: 'tip', content: tip },
      })
      if (error) {
        errors.push(`"${tip.tip_id ?? tip.concept ?? 'unknown'}": ${error.message}`)
      } else {
        const r = data as { ok: boolean; message?: string }
        if (!r.ok) errors.push(`"${tip.tip_id ?? tip.concept ?? 'unknown'}": ${r.message ?? 'Unknown error'}`)
        else saved++
      }
    }

    setBatchSaveStatus({ saved, failed: errors.length, errors })
    setVersionsRefresh((s) => s + 1)
  }

  async function handlePromote(): Promise<void> {
    if (singleResult?.ok !== true) return
    if (promoteStatus === 'promoting') return
    if (saveStatus !== 'saved' || effectiveId === null) return
    setPromoteStatus('promoting')
    const { data, error } = await supabaseProd.functions.invoke('promote-to-prod', {
      body: { content_id: effectiveId, content_type: 'tip' },
    })
    if (error) {
      setPromoteStatus({ error: error.message })
      return
    }
    type PromoteOk = { ok: true; content_id: string; content_type: string; version_number: number }
    type PromoteErr = { ok: false; message: string }
    const result = data as PromoteOk | PromoteErr
    if (!result.ok) {
      setPromoteStatus({ error: result.message })
      return
    }
    setPromoteStatus({ promoted: result.version_number })
    setVersionsRefresh((s) => s + 1)
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Tip Validator</h1>
        <p className="text-ink-2">
          Paste a tip JSON (single object or array), validate, save to staging, and promote to production.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => loadSample(validSample)}
          className="px-3 py-1.5 text-sm rounded bg-surface-raised hover:bg-surface-overlay text-ink"
        >
          Load Sample (Valid)
        </button>
        <button
          type="button"
          onClick={() => loadSample(invalidSample)}
          className="px-3 py-1.5 text-sm rounded bg-surface-raised hover:bg-surface-overlay text-ink"
        >
          Load Sample (Invalid)
        </button>
      </div>

      <div>
        <label htmlFor="tip-json" className="sr-only">
          Tip JSON
        </label>
        <textarea
          id="tip-json"
          rows={14}
          value={inputText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Paste tip JSON here... (single object or array of objects)"
          className="w-full font-mono text-sm bg-canvas text-ink placeholder-ink-3 border border-line rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          spellCheck={false}
        />
      </div>

      {/* Single-item actions */}
      {!isBatch && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleValidate}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Validate
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave || operationInFlight}
            className="px-4 py-2 rounded bg-surface-raised hover:bg-surface-overlay text-ink font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save to Staging
          </button>
          <button
            type="button"
            onClick={() => void handlePromote()}
            disabled={!canSave || operationInFlight || saveStatus !== 'saved'}
            className="px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Promote to Production
          </button>
        </div>
      )}

      {/* Batch actions */}
      {isBatch && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleValidate}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            Validate
          </button>
          <button
            type="button"
            onClick={() => void handleBatchSave()}
            disabled={!allBatchValid || isBatchSaving}
            className="px-4 py-2 rounded bg-surface-raised hover:bg-surface-overlay text-ink font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isBatchSaving ? 'Saving…' : `Save All ${batchResults.length} to Staging`}
          </button>
        </div>
      )}

      {canSave && saveStatus !== 'saved' && !isBatch ? (
        <p className="text-sm text-ink-2">
          Save to staging first; promotion publishes the staged copy.
        </p>
      ) : null}

      <div aria-live="polite" className="space-y-3">
        {/* Single-item validation result */}
        {singleResult !== null && renderSinglePanel(singleResult)}

        {isSaving ? <p className="text-sm text-ink-2">Saving…</p> : null}
        {saveStatus === 'saved' && effectiveId !== null ? (
          <p className="text-sm text-green-400">Saved to staging as {effectiveId}</p>
        ) : null}
        {typeof saveStatus === 'object' ? (
          <p className="text-sm text-red-400">Save failed: {saveStatus.error}</p>
        ) : null}

        {isPromoting ? <p className="text-sm text-ink-2">Promoting…</p> : null}
        {typeof promoteStatus === 'object' && 'promoted' in promoteStatus ? (
          <p className="text-sm text-green-400">
            Promoted to production as v{promoteStatus.promoted}
          </p>
        ) : null}
        {typeof promoteStatus === 'object' && 'error' in promoteStatus ? (
          <p className="text-sm text-red-400">Promote failed: {promoteStatus.error}</p>
        ) : null}

        {/* Batch validation results */}
        {isBatch && batchResults !== null && renderBatchPanel(batchResults)}

        {/* Batch save result */}
        {typeof batchSaveStatus === 'object' && (
          <div className={`rounded border px-4 py-3 space-y-1 ${batchSaveStatus.failed === 0 ? 'border-green-600 bg-green-600/10 text-green-300' : 'border-yellow-600 bg-yellow-600/10 text-yellow-300'}`}>
            <p className="font-medium">
              {batchSaveStatus.saved} saved, {batchSaveStatus.failed} failed
            </p>
            {batchSaveStatus.errors.map((e, i) => (
              <p key={i} className="text-sm">{e}</p>
            ))}
          </div>
        )}
      </div>

      {!isBatch && effectiveId !== null ? (
        <VersionsPanel
          contentId={effectiveId}
          contentType="tip"
          refreshSignal={versionsRefresh}
          onAfterRollback={(content) => {
            setVersionsRefresh((s) => s + 1)
            if (content != null) {
              setInputText(JSON.stringify(content, null, 2))
              resetTransientState()
            }
          }}
        />
      ) : null}
    </section>
  )
}

function renderSinglePanel(state: SingleValidation): JSX.Element {
  if (state.ok) {
    return (
      <div className="rounded border border-green-600 bg-green-600/10 text-green-300 px-4 py-3">
        <strong className="text-green-200">✓ Valid tip</strong>
        {' · '}
        {state.data.tip_id}
        {state.data.principle_tag ? ` · ${state.data.principle_tag}` : ''}
      </div>
    )
  }
  if ('parseError' in state) {
    return (
      <div className="rounded border border-red-600 bg-red-600/10 text-red-300 px-4 py-3">
        <strong className="text-red-200">Invalid JSON:</strong> {state.parseError}
      </div>
    )
  }
  return (
    <ul className="rounded border border-red-600 bg-red-600/10 text-red-300 px-4 py-3 space-y-1">
      {state.errors.map((err, i) => (
        <li key={i} className="text-sm leading-relaxed">
          <span className="font-mono text-red-200">{err.path}</span>
          <span>: </span>
          <span>{err.message}</span>
        </li>
      ))}
    </ul>
  )
}

function renderBatchPanel(results: ItemValidation[]): JSX.Element {
  const validCount = results.filter((r) => r.ok).length
  const allValid = validCount === results.length

  return (
    <div className="space-y-2">
      <div className={`rounded border px-4 py-3 ${allValid ? 'border-green-600 bg-green-600/10 text-green-300' : 'border-yellow-600 bg-yellow-600/10 text-yellow-300'}`}>
        <strong>{validCount} of {results.length} tips valid</strong>
        {!allValid && <span className="ml-2 text-sm">— fix errors below before saving</span>}
      </div>
      {results.map((result, idx) => (
        <div key={idx} className={`rounded border px-4 py-2 ${result.ok ? 'border-green-800 bg-green-900/20 text-green-400' : 'border-red-700 bg-red-900/20 text-red-400'}`}>
          <p className="text-sm font-medium mb-1">
            {result.ok ? '✓' : '✗'} Item {idx + 1}
            {result.ok && result.data.tip_id ? ` · ${result.data.tip_id}` : ''}
            {result.ok && result.data.concept ? ` · ${result.data.concept}` : ''}
          </p>
          {!result.ok && 'errors' in result && (
            <ul className="space-y-0.5">
              {result.errors.map((err, i) => (
                <li key={i} className="text-xs">
                  <span className="font-mono">{err.path}</span>: {err.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
