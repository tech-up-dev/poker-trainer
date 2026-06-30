import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import type { Tip } from '../../shared/schemas/tip'
import { supabaseProd } from '../lib/supabase-prod'
import { validateTip, type FieldError } from '../lib/validate'
import validSample from '../../samples/valid-tip.json'
import invalidSample from '../../samples/invalid-tip.json'
import { VersionsPanel } from './VersionsPanel'

type ValidationState =
  | { ok: true; data: Tip }
  | { ok: false; errors: FieldError[] }
  | { ok: false; parseError: string }

type SaveStatus = 'idle' | 'saving' | 'saved' | { error: string }

type PromoteStatus =
  | 'idle'
  | 'promoting'
  | { promoted: number }
  | { error: string }

type TipEditorProps = {
  onPublishedContextChange: (ctx: {
    contentId: string | null
    contentType: string | null
    refreshSignal: number
  }) => void
  // Pre-fill the editor (e.g. when opening a staged item to edit).
  initialText?: string
}

export function TipEditor({ onPublishedContextChange, initialText }: TipEditorProps): JSX.Element {
  const [inputText, setInputText] = useState(initialText ?? '')
  const [validationResult, setValidationResult] = useState<ValidationState | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [promoteStatus, setPromoteStatus] = useState<PromoteStatus>('idle')
  const [versionsRefresh, setVersionsRefresh] = useState(0)
  // The id assigned by the server when the author omits tip_id. Versions and
  // promotion key off this once a save has happened.
  const [savedId, setSavedId] = useState<string | null>(null)

  const explicitId =
    validationResult?.ok === true ? validationResult.data.tip_id ?? null : null
  const effectiveId = explicitId ?? savedId

  useEffect(() => {
    onPublishedContextChange({
      contentId: effectiveId,
      contentType: effectiveId ? 'tip' : null,
      refreshSignal: versionsRefresh,
    })
  }, [effectiveId, versionsRefresh, onPublishedContextChange])

  const canSave = validationResult?.ok === true
  const isSaving = saveStatus === 'saving'
  const isPromoting = promoteStatus === 'promoting'
  const operationInFlight = isSaving || isPromoting

  function resetTransientState(): void {
    setValidationResult(null)
    setSaveStatus('idle')
    setPromoteStatus('idle')
    setSavedId(null)
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
      setValidationResult({ ok: false, parseError: message })
      setSaveStatus('idle')
      setPromoteStatus('idle')
      return
    }
    setValidationResult(validateTip(parsed))
    setSaveStatus('idle')
    setPromoteStatus('idle')
  }

  async function handleSave(): Promise<void> {
    if (validationResult?.ok !== true) return
    if (saveStatus === 'saving') return
    const tip = validationResult.data
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
      // Refresh the side panels so the Staging copy reflects what we just saved.
      setVersionsRefresh((s) => s + 1)
    }
  }

  async function handlePromote(): Promise<void> {
    if (validationResult?.ok !== true) return
    if (promoteStatus === 'promoting') return
    // Promotion publishes the staged copy, so the editor content must have been
    // saved to staging first, otherwise we'd promote a stale version.
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
        <p className="text-slate-400">
          Paste a tip JSON, validate, save to staging, and promote to production.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => loadSample(validSample)}
          className="px-3 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
        >
          Load Sample (Valid)
        </button>
        <button
          type="button"
          onClick={() => loadSample(invalidSample)}
          className="px-3 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 text-slate-100"
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
          placeholder="Paste tip JSON here..."
          className="w-full font-mono text-sm bg-slate-950 text-slate-100 placeholder-slate-500 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          spellCheck={false}
        />
      </div>

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
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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

      {canSave && saveStatus !== 'saved' ? (
        <p className="text-sm text-slate-400">
          Save to staging first; promotion publishes the staged copy.
        </p>
      ) : null}

      <div aria-live="polite" className="space-y-3">
        {validationResult !== null && renderValidationPanel(validationResult)}

        {isSaving ? <p className="text-sm text-slate-400">Saving…</p> : null}
        {saveStatus === 'saved' && effectiveId !== null ? (
          <p className="text-sm text-green-400">
            Saved to staging as {effectiveId}
          </p>
        ) : null}
        {typeof saveStatus === 'object' ? (
          <p className="text-sm text-red-400">Save failed: {saveStatus.error}</p>
        ) : null}

        {isPromoting ? (
          <p className="text-sm text-slate-400">Promoting…</p>
        ) : null}
        {typeof promoteStatus === 'object' && 'promoted' in promoteStatus ? (
          <p className="text-sm text-green-400">
            Promoted to production as v{promoteStatus.promoted}
          </p>
        ) : null}
        {typeof promoteStatus === 'object' && 'error' in promoteStatus ? (
          <p className="text-sm text-red-400">
            Promote failed: {promoteStatus.error}
          </p>
        ) : null}
      </div>

      {effectiveId !== null ? (
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

function renderValidationPanel(state: ValidationState): JSX.Element {
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
