import { useState } from 'react'
import type { JSX } from 'react'

import type { Lesson } from '../../shared/schemas/lesson'

import { supabase } from '../lib/supabase'
import { validateLesson, type FieldError } from '../lib/validate'
import validSample from '../../samples/valid-lesson.json'
import invalidSample from '../../samples/invalid-lesson.json'

type ValidationState =
  | { ok: true; data: Lesson }
  | { ok: false; errors: FieldError[] }
  | { ok: false; parseError: string }

type SaveStatus = 'idle' | 'saving' | 'saved' | { error: string }

export function LessonValidator(): JSX.Element {
  const [inputText, setInputText] = useState('')
  const [validationResult, setValidationResult] = useState<ValidationState | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const canSave = validationResult?.ok === true

  function loadSample(sample: unknown): void {
    setInputText(JSON.stringify(sample, null, 2))
    setValidationResult(null)
    setSaveStatus('idle')
  }

  function handleTextChange(value: string): void {
    setInputText(value)
    setValidationResult(null)
    setSaveStatus('idle')
  }

  function handleValidate(): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(inputText)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to parse JSON'
      setValidationResult({ ok: false, parseError: message })
      return
    }
    setValidationResult(validateLesson(parsed))
  }

  async function handleSave(): Promise<void> {
    if (validationResult?.ok !== true) return
    const lesson = validationResult.data
    setSaveStatus('saving')
    const { error } = await supabase.from('lessons_staging').upsert({
      lesson_id: lesson.lesson_id,
      content: lesson,
      updated_at: new Date().toISOString(),
    })
    if (error) setSaveStatus({ error: error.message })
    else setSaveStatus('saved')
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Lesson Validator</h1>
        <p className="text-slate-400">
          Paste a lesson JSON, validate, and save to staging.
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
        <label htmlFor="lesson-json" className="sr-only">
          Lesson JSON
        </label>
        <textarea
          id="lesson-json"
          rows={20}
          value={inputText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Paste lesson JSON here..."
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
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save to Staging
        </button>
      </div>

      <div aria-live="polite" className="space-y-3">
        {validationResult !== null && renderValidationPanel(validationResult)}

        {saveStatus === 'saving' ? (
          <p className="text-sm text-slate-400">Saving…</p>
        ) : null}
        {saveStatus === 'saved' && validationResult?.ok === true ? (
          <p className="text-sm text-green-400">
            Saved to staging as lesson_id: {validationResult.data.lesson_id}
          </p>
        ) : null}
        {typeof saveStatus === 'object' ? (
          <p className="text-sm text-red-400">Save failed: {saveStatus.error}</p>
        ) : null}
      </div>
    </section>
  )
}

function renderValidationPanel(state: ValidationState): JSX.Element {
  if (state.ok) {
    return (
      <div className="rounded border border-green-600 bg-green-600/10 text-green-300 px-4 py-3">
        <strong className="text-green-200">✓ Valid lesson</strong>
        {' — '}
        {state.data.title} · {state.data.questions.length} questions
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
