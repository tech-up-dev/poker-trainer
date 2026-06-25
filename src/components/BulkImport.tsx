import { useState } from 'react'
import type { JSX } from 'react'

import { supabaseProd } from '../lib/supabase-prod'
import { detectAndValidate, type FieldError } from '../lib/validate'
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

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | {
      kind: 'done'
      saved: { contentType: ContentType; contentId: string }[]
      failures: { index: number; message: string }[]
    }

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

    const items: ItemResult[] = toBatch(parsed).map((item, index) => {
      const result = detectAndValidate(item, CANDIDATE_TYPES)
      if (result.ok) return { index, ok: true, contentType: result.contentType, data: result.data }
      return { index, ok: false, errors: result.errors }
    })

    setParseState({ kind: 'validated', items })
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
        failures.push({ index: item.index, message: result?.message ?? error?.message ?? 'Unknown error' })
      } else {
        saved.push({ contentType: item.contentType, contentId: result.content_id ?? '(unknown)' })
      }
    }

    setSaveState({ kind: 'done', saved, failures })
  }

  return (
    <section className="space-y-6 max-w-3xl">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Bulk Import</h1>
        <p className="text-slate-400">
          Paste a JSON array, a single object, or a wrapper like{' '}
          <code className="text-slate-300">{'{ "glossary": [ … ] }'}</code>. Each
          item's type is detected automatically ({CANDIDATE_TYPES.join(', ')}).
          Validate the batch, then save every valid item to staging in one step.
          Missing ids are generated for you.
        </p>
      </header>

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
              <span className={invalidItems.length > 0 ? 'text-red-400 font-medium' : 'text-slate-400'}>
                {invalidItems.length} invalid
              </span>
              <span className="text-slate-500">
                {' '}
                of {parseState.items.length} item
                {parseState.items.length === 1 ? '' : 's'}
              </span>
            </div>
            {validItems.length > 0 ? (
              <div className="text-slate-400">
                {summarizeByType(validItems)}
              </div>
            ) : null}
          </div>
        ) : null}

        {invalidItems.map((item) => (
          <div
            key={item.index}
            className="rounded border border-red-600 bg-red-600/10 px-4 py-3 space-y-1"
          >
            <p className="text-red-200 text-sm font-medium">
              Item {item.index + 1} — no matching content type
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
          </div>
        ) : null}
      </div>
    </section>
  )
}

function summarizeByType(
  items: Extract<ItemResult, { ok: true }>[]
): string {
  const counts = new Map<ContentType, number>()
  for (const item of items) {
    counts.set(item.contentType, (counts.get(item.contentType) ?? 0) + 1)
  }
  return [...counts.entries()].map(([type, n]) => `${n} ${type}`).join(' · ')
}
