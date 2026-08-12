import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import { supabaseProd } from '../lib/supabase-prod'

type Concept = { slug: string; name: string; sort_order: number }
type Draft = { slug: string; name: string; sort_order: string }

const BLANK: Draft = { slug: '', name: '', sort_order: '' }

export function ConceptsAdminPage(): JSX.Element {
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(BLANK)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Concept | null>(null)
  const [editDraft, setEditDraft] = useState<{ name: string; sort_order: string }>({ name: '', sort_order: '' })
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    const { data, error: err } = await supabaseProd
      .from('concepts')
      .select('slug,name,sort_order')
      .order('sort_order')
    if (err) { setError(err.message); setLoading(false); return }
    setConcepts((data ?? []) as Concept[])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function handleAdd(): Promise<void> {
    if (!draft.slug.trim() || !draft.name.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabaseProd.from('concepts').upsert({
      slug: draft.slug.trim(),
      name: draft.name.trim(),
      sort_order: parseInt(draft.sort_order || '0', 10),
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setDraft(BLANK)
    void load()
  }

  async function handleEdit(): Promise<void> {
    if (!editing) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabaseProd.from('concepts').upsert({
      slug: editing.slug,
      name: editDraft.name.trim(),
      sort_order: parseInt(editDraft.sort_order || '0', 10),
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditing(null)
    void load()
  }

  async function handleDelete(slug: string): Promise<void> {
    setDeleting(true)
    setError(null)
    const { error: err } = await supabaseProd.from('concepts').delete().eq('slug', slug)
    setDeleting(false)
    setDeleteSlug(null)
    if (err) { setError(err.message); return }
    void load()
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-ink">Concept Vocabulary</h1>
      {error && <p className="text-sm text-error">{error}</p>}

      {/* Add new concept */}
      <div className="bg-surface rounded-xl border border-line p-4 space-y-3">
        <p className="text-sm font-semibold text-ink-2 uppercase tracking-widest text-xs">Add concept</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={draft.slug}
            onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
            placeholder="slug (e.g. pot_odds)"
            className="flex-1 bg-canvas border border-line rounded px-3 py-2 text-sm text-ink outline-none focus:border-link"
          />
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Display name"
            className="flex-1 bg-canvas border border-line rounded px-3 py-2 text-sm text-ink outline-none focus:border-link"
          />
          <input
            type="number"
            value={draft.sort_order}
            onChange={(e) => setDraft((d) => ({ ...d, sort_order: e.target.value }))}
            placeholder="Order"
            className="w-20 bg-canvas border border-line rounded px-3 py-2 text-sm text-ink outline-none focus:border-link"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={saving || !draft.slug.trim() || !draft.name.trim()}
            className="px-4 py-2 rounded bg-link text-white text-sm disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Concepts list */}
      {loading ? (
        <p className="text-sm text-ink-2">Loading…</p>
      ) : (
        <div className="rounded-xl border border-line divide-y divide-line">
          {concepts.length === 0 && (
            <p className="text-sm text-ink-2 p-4">No concepts yet.</p>
          )}
          {concepts.map((c) => (
            <div key={c.slug} className="p-3 space-y-2">
              {editing?.slug === c.slug ? (
                <div className="flex gap-2 items-center">
                  <span className="font-mono text-xs text-ink-3 w-32 shrink-0">{c.slug}</span>
                  <input
                    type="text"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                    className="flex-1 bg-canvas border border-line rounded px-2 py-1 text-sm text-ink outline-none focus:border-link"
                  />
                  <input
                    type="number"
                    value={editDraft.sort_order}
                    onChange={(e) => setEditDraft((d) => ({ ...d, sort_order: e.target.value }))}
                    className="w-20 bg-canvas border border-line rounded px-2 py-1 text-sm text-ink outline-none focus:border-link"
                  />
                  <button
                    type="button"
                    onClick={() => void handleEdit()}
                    disabled={saving}
                    className="text-xs px-3 py-1 rounded bg-link text-white disabled:opacity-40"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="text-xs px-2 py-1 rounded bg-surface text-ink-2 hover:bg-surface-raised"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-ink-3 w-32 shrink-0">{c.slug}</span>
                    <span className="text-sm text-ink">{c.name}</span>
                    <span className="text-xs text-ink-3">#{c.sort_order}</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => { setEditing(c); setEditDraft({ name: c.name, sort_order: String(c.sort_order) }) }}
                      className="text-xs px-2 py-1 rounded bg-surface hover:bg-surface-raised text-ink-2"
                    >
                      Edit
                    </button>
                    {deleteSlug === c.slug ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleDelete(c.slug)}
                          disabled={deleting}
                          className="text-xs px-2 py-1 rounded bg-error text-white disabled:opacity-40"
                        >
                          {deleting ? 'Deleting…' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteSlug(null)}
                          className="text-xs px-2 py-1 rounded bg-surface text-ink-2"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteSlug(c.slug)}
                        className="text-xs px-2 py-1 rounded bg-surface hover:bg-error/20 text-error"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
