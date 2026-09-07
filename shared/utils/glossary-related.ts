import type { GlossaryEntry } from '../schemas/glossary.ts'

// A glossary entry's `related_terms` is documented (schema comment) to hold
// term_ids for nested linking, but authored JSON often carries the term text
// ("Old Man Coffee", "SPR") instead of the slug ("old-man-coffee", "spr").
// The FE looks these up by term_id and silently drops anything that misses,
// so ~56% of Steve's related_terms references failed to render (#41 retest).
//
// This util normalises each entry's `related_terms` against the full glossary
// list: exact term_id matches stay as-is, otherwise match by term text
// case-insensitively and replace with the target's term_id. Values that
// resolve to nothing are kept verbatim so a link to a not-yet-imported term
// starts working the next time normalisation runs after that term lands.

type EntryLike = { term_id?: string; term?: string; related_terms?: string[] }

function buildTermIndex(all: EntryLike[]): {
  idSet: Set<string>
  byTerm: Map<string, string>
} {
  const idSet = new Set<string>()
  const byTerm = new Map<string, string>()
  for (const e of all) {
    if (e.term_id) idSet.add(e.term_id)
    if (e.term && e.term_id) byTerm.set(e.term.toLowerCase(), e.term_id)
  }
  return { idSet, byTerm }
}

function normalizeList(
  related: string[] | undefined,
  index: { idSet: Set<string>; byTerm: Map<string, string> },
): { next: string[]; changed: boolean } {
  if (!Array.isArray(related) || related.length === 0) {
    return { next: [], changed: false }
  }
  let changed = false
  const seen = new Set<string>()
  const next: string[] = []
  for (const raw of related) {
    if (typeof raw !== 'string' || !raw.trim()) {
      changed = true
      continue
    }
    let value = raw
    if (!index.idSet.has(value)) {
      const mapped = index.byTerm.get(value.toLowerCase())
      if (mapped) {
        value = mapped
        changed = true
      }
    }
    if (seen.has(value)) {
      changed = true
      continue
    }
    seen.add(value)
    next.push(value)
  }
  if (next.length !== related.length) changed = true
  return { next, changed }
}

// Rewrite one entry's related_terms in place-friendly form: returns a copy of
// `entry` with related_terms normalised against `all`. Idempotent - re-running
// on an already-normalised entry is a no-op.
export function normalizeRelatedTerms(
  entry: GlossaryEntry,
  all: EntryLike[],
): GlossaryEntry {
  const index = buildTermIndex(all)
  const { next, changed } = normalizeList(entry.related_terms, index)
  if (!changed && next.length === (entry.related_terms?.length ?? 0)) {
    return entry
  }
  const out: GlossaryEntry = { ...entry }
  if (next.length > 0) out.related_terms = next
  else delete out.related_terms
  return out
}

// Batch pass: return the entries whose related_terms actually changed, so the
// caller can upsert only the diff. `all` is the same list, snapshotted once,
// so a save that renames a term_id reflects into every referencing entry in
// one go.
export function normalizeAllRelatedTerms<T extends EntryLike & { term_id?: string }>(
  entries: Array<{ content_id: string; content: T }>,
): Array<{ content_id: string; content: T }> {
  const index = buildTermIndex(entries.map((r) => r.content))
  const changedRows: Array<{ content_id: string; content: T }> = []
  for (const row of entries) {
    const { next, changed } = normalizeList(row.content.related_terms, index)
    if (!changed && next.length === (row.content.related_terms?.length ?? 0)) continue
    const nextContent: T = { ...row.content }
    if (next.length > 0) nextContent.related_terms = next
    else delete nextContent.related_terms
    changedRows.push({ content_id: row.content_id, content: nextContent })
  }
  return changedRows
}
