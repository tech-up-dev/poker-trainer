import { useState } from 'react'
import type { JSX } from 'react'

import type { Lesson } from '../../shared/schemas/lesson'
import { supabaseProd } from '../lib/supabase-prod'
import { validateLesson, type FieldError } from '../lib/validate'

// Bulk import is the client's main content workflow: he generates large batches
// of lessons with Claude using the schema doc, then loads them here. We accept a
// JSON array (or a single object), validate every item against the same Zod
// schema the single-lesson validator uses, and let him save all the valid ones
// to staging in one go. Invalid items are listed with field-path errors so he
// can fix them without a developer.

type ItemResult =
  | { index: number; ok: true; lesson: Lesson }
  | { index: number; ok: false; lessonId: string | null; errors: FieldError[] }

type ParseState =
  | { kind: 'idle' }
  | { kind: 'parseError'; message: string }
  | { kind: 'validated'; items: ItemResult[] }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'done'; saved: number; failures: { lessonId: string; message: string }[] }

function readLessonId(item: unknown): string | null {
  if (typeof item === 'object' && item !== null && 'lesson_id' in item) {
    const value = (item as Record<string, unknown>).lesson_id
    return typeof value === 'string' ? value : null
  }
  return null
}

export function BulkImport(): JSX.Element {
  const [inputText, setInputText] = useState('')
  const [parseState, setParseState] = useState<ParseState>({ kind: 'idle' })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })

  const validItems =
    parseState.kind === 'validated'
      ? parseState.items.filter((item): item is Extract<ItemResult, { ok: true }> => item.ok)
      : []
  const invalidItems =
    parseState.kind === 'validated'
      ? parseState.items.filter((item): item is Extract<ItemResult, { ok: false }> => !item.ok)
      : []

  const isSaving = saveState.kind === 'saving'
  const canSave = validItems.length > 0 && !isSaving

  function handleTextChange(value: string): void {
    setInputText(value)
    setParseState({ kind: 'idle' })
    setSaveState({ kind: 'idle' })
  }

  function handleValidate(): void {
    setSaveState({ kind: 'idle' })

    let parsed: unknown
    try {
      parsed = JSON.parse(inputText)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to parse JSON'
      setParseState({ kind: 'parseError', message })
      return
    }

    const batch = Array.isArray(parsed) ? parsed : [parsed]
    const items: ItemResult[] = batch.map((item, index) => {
      const result = validateLesson(item)
      if (result.ok) return { index, ok: true, lesson: result.data }
      return { index, ok: false, lessonId: readLessonId(item), errors: result.errors }
    })

    setParseState({ kind: 'validated', items })
  }

  async function handleSaveValid(): Promise<void> {
    if (validItems.length === 0 || isSaving) return
    setSaveState({ kind: 'saving' })

    let saved = 0
    const failures: { lessonId: string; message: string }[] = []
    for (const item of validItems) {
      const { data, error } = await supabaseProd.functions.invoke('save-to-staging', {
        body: { content_id: item.lesson.lesson_id, content_type: 'lesson', content: item.lesson },
      })
      const result = data as { ok: boolean; message?: string } | null
      if (error || !result?.ok) {
        failures.push({ lessonId: item.lesson.lesson_id, message: result?.message ?? error?.message ?? 'Unknown error' })
      } else {
        saved++
      }
    }

    setSaveState({ kind: 'done', saved, failures })
  }

  return (
    <section className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Bulk Import</h1>
        <p className="text-slate-400">
          Paste a JSON array of lessons (or a single lesson). Validate the batch,
          then save every valid lesson to staging in one step.
        </p>
      </header>

      <div>
        <label htmlFor="bulk-json" className="sr-only">
          Lessons JSON
        </label>
        <textarea
          id="bulk-json"
          rows={20}
          value={inputText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder='[ { "lesson_id": "...", "title": "...", ... }, { ... } ]'
          className="w-full font-mono text-sm bg-slate-950 text-slate-100 placeholder-slate-500 border border-slate-700 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleValidate}
          disabled={inputText.trim().length === 0}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Validate Batch
        </button>
        <button
          type="button"
          onClick={handleSaveValid}
          disabled={!canSave}
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving
            ? 'Saving…'
            : `Save ${validItems.length} Valid to Staging`}
        </button>
      </div>

      <div aria-live="polite" className="space-y-4">
        {parseState.kind === 'parseError' ? (
          <div className="rounded border border-red-600 bg-red-600/10 text-red-300 px-4 py-3">
            <strong className="text-red-200">Invalid JSON:</strong> {parseState.message}
          </div>
        ) : null}

        {parseState.kind === 'validated' ? (
          <div className="rounded border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm">
            <span className="text-green-400 font-medium">{validItems.length} valid</span>
            <span className="text-slate-500"> · </span>
            <span className={invalidItems.length > 0 ? 'text-red-400 font-medium' : 'text-slate-400'}>
              {invalidItems.length} invalid
            </span>
            <span className="text-slate-500">
              {' '}
              of {parseState.items.length} item
              {parseState.items.length === 1 ? '' : 's'}
            </span>
          </div>
        ) : null}

        {invalidItems.map((item) => (
          <div
            key={item.index}
            className="rounded border border-red-600 bg-red-600/10 px-4 py-3 space-y-1"
          >
            <p className="text-red-200 text-sm font-medium">
              Item {item.index + 1}
              {item.lessonId !== null ? ` (lesson_id: ${item.lessonId})` : ' (no lesson_id)'}
            </p>
            <ul className="space-y-1">
              {item.errors.map((err, i) => (
                <li key={i} className="text-sm leading-relaxed text-red-300">
                  <span className="font-mono text-red-200">{err.path}</span>
                  <span>: </span>
                  <span>{err.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {saveState.kind === 'done' ? (
          <div className="space-y-2">
            <p className="text-sm text-green-400">
              Saved {saveState.saved} lesson{saveState.saved === 1 ? '' : 's'} to staging.
            </p>
            {saveState.failures.map((failure) => (
              <p key={failure.lessonId} className="text-sm text-red-400">
                {failure.lessonId}: {failure.message}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
