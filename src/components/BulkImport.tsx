import { useState } from 'react'
import type { ChangeEvent, JSX } from 'react'

import { supabaseProd } from '../lib/supabase-prod'
import { detectAndValidate, type FieldError } from '../lib/validate'
import { parseCsv, parseMarkdownLesson } from '../lib/parse-content'
import type { ContentType } from '../../shared/schemas/content'

// Bulk import is the client's main content workflow: he generates large batches
// with Claude using the schema doc, then loads them here. We accept a JSON array,
// a single object, or a one-key wrapper like { "glossary": [ … ] }. Each item is
// auto-detected against the content types this build supports, validated, and the
// valid ones saved to staging in one go. Ids are assigned server-side when the
// author omits them.
const CANDIDATE_TYPES: ContentType[] = ['lesson', 'glossary', 'tip', 'reference']

type ItemResult =
  | { index: number; ok: true; contentType: ContentType; data: unknown }
  | { index: number; ok: false; errors: FieldError[] }

type ParseState =
  | { kind: 'idle' }
  | { kind: 'parseError'; message: string }
  | { kind: 'validated'; items: ItemResult[] }

type Saved = { contentType: ContentType; contentId: string }

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | {
      kind: 'done'
      saved: Saved[]
      failures: { index: number; message: string }[]
    }

type PromoteState =
  | { kind: 'idle' }
  | { kind: 'promoting'; done: number; total: number }
  | { kind: 'done'; promoted: number; failures: { contentId: string; message: string }[] }

// Array as-is; a one-key object whose value is an array is unwrapped (handles
// { "glossary": [ … ] }); anything else is treated as a single item. The
// one-key rule avoids mistaking a lesson's "questions" array for the batch.
function toBatch(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed !== null && typeof parsed === 'object') {
    const keys = Object.keys(parsed as Record<string, unknown>)
    if (keys.length === 1) {
      const only = (parsed as Record<string, unknown>)[keys[0]]
      if (Array.isArray(only)) return only
    }
    return [parsed]
  }
  return [parsed]
}

export function BulkImport(): JSX.Element {
  const [inputText, setInputText] = useState('')
  const [parseState, setParseState] = useState<ParseState>({ kind: 'idle' })
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })
  const [promoteState, setPromoteState] = useState<PromoteState>({ kind: 'idle' })

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
    setPromoteState({ kind: 'idle' })
  }

  // Detect + validate a batch of raw items (from JSON paste, CSV, or Markdown)
  // through the one shared path, then show the per-item results.
  function validateBatch(batch: unknown[]): void {
    setSaveState({ kind: 'idle' })
    setPromoteState({ kind: 'idle' })

    const items: ItemResult[] = batch.map((item, index) => {
      const result = detectAndValidate(item, CANDIDATE_TYPES)
      if (result.ok) return { index, ok: true, contentType: result.contentType, data: result.data }
      return { index, ok: false, errors: result.errors }
    })

    setParseState({ kind: 'validated', items })
  }

  function handleValidate(): void {
    setSaveState({ kind: 'idle' })
    setPromoteState({ kind: 'idle' })

    let parsed: unknown
    try {
      parsed = JSON.parse(inputText)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to parse JSON'
      setParseState({ kind: 'parseError', message })
      return
    }

    validateBatch(toBatch(parsed))
  }

  // Import a file by extension: .json (array/object/wrapper), .csv (one row per
  // item), or .md/.markdown (a single prose lesson). All converge on validateBatch.
  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setInputText('')

    let text: string
    try {
      text = await file.text()
    } catch {
      setParseState({ kind: 'parseError', message: 'Could not read the file' })
      return
    }

    const ext = file.name.split('.').pop()?.toLowerCase()
    try {
      if (ext === 'json') {
        validateBatch(toBatch(JSON.parse(text)))
      } else if (ext === 'csv') {
        validateBatch(parseCsv(text))
      } else if (ext === 'md' || ext === 'markdown') {
        validateBatch([parseMarkdownLesson(text)])
      } else {
        setParseState({ kind: 'parseError', message: `Unsupported file type: .${ext ?? '?'}` })
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to parse file'
      setParseState({ kind: 'parseError', message })
    }
  }

  async function handleSaveValid(): Promise<void> {
    if (validItems.length === 0 || isSaving) return
    setSaveState({ kind: 'saving' })

    const saved: { contentType: ContentType; contentId: string }[] = []
    const failures: { index: number; message: string }[] = []
    for (const item of validItems) {
      const { data, error } = await supabaseProd.functions.invoke('save-to-staging', {
        body: { content_type: item.contentType, content: item.data },
      })
      const result = data as { ok: boolean; content_id?: string; message?: string } | null
      if (error || !result?.ok) {
        failures.push({
          index: item.index,
          message: result?.message ?? error?.message ?? 'Unknown error',
        })
      } else {
        saved.push({ contentType: item.contentType, contentId: result.content_id ?? '(unknown)' })
      }
    }

    setSaveState({ kind: 'done', saved, failures })
  }

  async function handlePromoteAll(saved: Saved[]): Promise<void> {
    if (saved.length === 0 || promoteState.kind === 'promoting') return
    setPromoteState({ kind: 'promoting', done: 0, total: saved.length })

    let promoted = 0
    const failures: { contentId: string; message: string }[] = []
    for (let i = 0; i < saved.length; i++) {
      const item = saved[i]
      const { data, error } = await supabaseProd.functions.invoke('promote-to-prod', {
        body: { content_id: item.contentId, content_type: item.contentType },
      })
      const result = data as { ok: boolean; message?: string } | null
      if (error || !result?.ok) {
        failures.push({
          contentId: item.contentId,
          message: result?.message ?? error?.message ?? 'Unknown error',
        })
      } else {
        promoted++
      }
      setPromoteState({ kind: 'promoting', done: i + 1, total: saved.length })
    }

    setPromoteState({ kind: 'done', promoted, failures })
  }

  return (
    <section className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Bulk Import</h1>
        <p className="text-slate-400">
          Paste JSON below, or import a <strong>.json</strong>, <strong>.csv</strong>, or{' '}
          <strong>.md</strong> file. Each item's type is detected automatically (
          {CANDIDATE_TYPES.join(', ')}). Validate the batch, then save every valid item to staging in
          one step. Missing ids are generated for you. See{' '}
          <code className="text-slate-300">docs/schema-spec.md</code> for the CSV columns and
          Markdown structure.
        </p>
      </header>

      <div>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 w-fit">
          Import file (.json, .csv, .md)
          <input
            type="file"
            accept=".json,.csv,.md,.markdown"
            onChange={(e) => void handleFile(e)}
            className="sr-only"
          />
        </label>
      </div>

      <div>
        <label htmlFor="bulk-json" className="sr-only">
          Content JSON
        </label>
        <textarea
          id="bulk-json"
          rows={20}
          value={inputText}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder='[ { … }, { … } ]  or  { "glossary": [ … ] }'
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
          onClick={() => void handleSaveValid()}
          disabled={!canSave}
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving…' : `Save ${validItems.length} Valid to Staging`}
        </button>
      </div>

      <div aria-live="polite" className="space-y-4">
        {parseState.kind === 'parseError' ? (
          <div className="rounded border border-red-600 bg-red-600/10 text-red-300 px-4 py-3">
            <strong className="text-red-200">Invalid JSON:</strong> {parseState.message}
          </div>
        ) : null}

        {parseState.kind === 'validated' ? (
          <div className="rounded border border-slate-700 bg-slate-800/50 px-4 py-3 text-sm space-y-1">
            <div>
              <span className="text-green-400 font-medium">{validItems.length} valid</span>
              <span className="text-slate-500"> · </span>
              <span
                className={invalidItems.length > 0 ? 'text-red-400 font-medium' : 'text-slate-400'}
              >
                {invalidItems.length} invalid
              </span>
              <span className="text-slate-500">
                {' '}
                of {parseState.items.length} item
                {parseState.items.length === 1 ? '' : 's'}
              </span>
            </div>
            {validItems.length > 0 ? (
              <div className="text-slate-400">{summarizeByType(validItems)}</div>
            ) : null}
          </div>
        ) : null}

        {invalidItems.map((item) => (
          <div
            key={item.index}
            className="rounded border border-red-600 bg-red-600/10 px-4 py-3 space-y-1"
          >
            <p className="text-red-200 text-sm font-medium">
              Item {item.index + 1}: no matching content type
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
              Saved {saveState.saved.length} item
              {saveState.saved.length === 1 ? '' : 's'} to staging.
            </p>
            {saveState.saved.length > 0 ? (
              <ul className="text-xs text-slate-400 space-y-0.5">
                {saveState.saved.map((s, i) => (
                  <li key={i}>
                    <span className="text-slate-500">{s.contentType}</span>{' '}
                    <span className="font-mono text-slate-300">{s.contentId}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {saveState.failures.map((failure) => (
              <p key={failure.index} className="text-sm text-red-400">
                Item {failure.index + 1}: {failure.message}
              </p>
            ))}

            {saveState.saved.length > 0 ? (
              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={() => void handlePromoteAll(saveState.saved)}
                  disabled={promoteState.kind === 'promoting'}
                  className="px-4 py-2 rounded bg-green-700 hover:bg-green-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {promoteState.kind === 'promoting'
                    ? `Promoting… ${promoteState.done}/${promoteState.total}`
                    : `Promote ${saveState.saved.length} to Production`}
                </button>

                {promoteState.kind === 'done' ? (
                  <div className="space-y-1">
                    <p className="text-sm text-green-400">
                      Promoted {promoteState.promoted} item
                      {promoteState.promoted === 1 ? '' : 's'} to production.
                    </p>
                    {promoteState.failures.map((failure, i) => (
                      <p key={i} className="text-sm text-red-400">
                        <span className="font-mono">{failure.contentId}</span>: {failure.message}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

function summarizeByType(items: Extract<ItemResult, { ok: true }>[]): string {
  const counts = new Map<ContentType, number>()
  for (const item of items) {
    counts.set(item.contentType, (counts.get(item.contentType) ?? 0) + 1)
  }
  return [...counts.entries()].map(([type, n]) => `${n} ${type}`).join(' · ')
}
