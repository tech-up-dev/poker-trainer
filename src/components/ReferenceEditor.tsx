import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import type { Reference } from '../../shared/schemas/reference'
import { supabaseProd } from '../lib/supabase-prod'
import { validateReference, type FieldError } from '../lib/validate'
import validSample from '../../samples/valid-reference.json'
import invalidSample from '../../samples/invalid-reference.json'
import { VersionsPanel } from './VersionsPanel'

type ValidationState =
  | { ok: true; data: Reference }
  | { ok: false; errors: FieldError[] }
  | { ok: false; parseError: string }

type SaveStatus = 'idle' | 'saving' | 'saved' | { error: string }

type PromoteStatus =
  | 'idle'
  | 'promoting'
  | { promoted: number }
  | { error: string }

type ReferenceEditorProps = {
  onPublishedContextChange: (ctx: {
    contentId: string | null
    contentType: string | null
    refreshSignal: number
  }) => void
}

export function ReferenceEditor({ onPublishedContextChange }: ReferenceEditorProps): JSX.Element {
  const [inputText, setInputText] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationState | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [promoteStatus, setPromoteStatus] = useState<PromoteStatus>('idle')
  const [versionsRefresh, setVersionsRefresh] = useState(0)

  useEffect(() => {
    const contentId =
      validationResult?.ok === true ? validationResult.data.reference_id : null
    onPublishedContextChange({ contentId, contentType: contentId ? 'reference' : null, refreshSignal: versionsRefresh })
  }, [validationResult, versionsRefresh, onPublishedContextChange])

  const canSave = validationResult?.ok === true
  const isSaving = saveStatus === 'saving'
  const isPromoting = promoteStatus === 'promoting'
  const operationInFlight = isSaving || isPromoting
  const validatedReferenceId =
    validationResult?.ok === true ? validationResult.data.reference_id : null

  function resetTransientState(): void {
    setValidationResult(null)
    setSaveStatus('idle')
    setPromoteStatus('idle')
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
    setValidationResult(validateReference(parsed))
    setSaveStatus('idle')
    setPromoteStatus('idle')
  }

  async function handleSave(): Promise<void> {
    if (validationResult?.ok !== true) return
    if (saveStatus === 'saving') return
    const ref = validationResult.data
    setSaveStatus('saving')
    const { data, error } = await supabaseProd.functions.invoke('save-to-staging', {
      body: { content_id: ref.reference_id, content_type: 'reference', content: ref },
    })
    if (error) {
      setSaveStatus({ error: error.message })
      return
    }
    const result = data as { ok: boolean; message?: string }
    if (!result.ok) setSaveStatus({ error: result.message ?? 'Unknown error' })
    else setSaveStatus('saved')
  }

  async function handlePromote(): Promise<void> {
    if (validationResult?.ok !== true) return
    if (promoteStatus === 'promoting') return
    const ref = validationResult.data
    setPromoteStatus('promoting')
    const { data, error } = await supabaseProd.functions.invoke('promote-to-prod', {
      body: { content_id: ref.reference_id, content_type: 'reference' },
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
        <h1 className="text-2xl font-semibold">Reference Validator</h1>
        <p className="text-slate-400">
          Paste a reference JSON, validate, save to staging, and promote to production.
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
        <label htmlFor="reference-json" className="sr-only">
          Reference JSON
        </label>
        <textarea
          id="reference-json"
          rows={20}
          value={inputText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Paste reference JSON here..."
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
          disabled={!canSave || operationInFlight}
          className="px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Promote to Production
        </button>
      </div>

      <div aria-live="polite" className="space-y-3">
        {validationResult !== null && renderValidationPanel(validationResult)}

        {isSaving ? <p className="text-sm text-slate-400">Saving…</p> : null}
        {saveStatus === 'saved' && validationResult?.ok === true ? (
          <p className="text-sm text-green-400">
            Saved to staging as {validationResult.data.reference_id}
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

      {validatedReferenceId !== null ? (
        <VersionsPanel
          contentId={validatedReferenceId}
          contentType="reference"
          refreshSignal={versionsRefresh}
          onAfterRollback={() => setVersionsRefresh((s) => s + 1)}
        />
      ) : null}
    </section>
  )
}

function renderValidationPanel(state: ValidationState): JSX.Element {
  if (state.ok) {
    return (
      <div className="rounded border border-green-600 bg-green-600/10 text-green-300 px-4 py-3">
        <strong className="text-green-200">✓ Valid reference</strong>
        {' — '}
        {state.data.title}
        {state.data.category ? ` · ${state.data.category}` : ''}
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
