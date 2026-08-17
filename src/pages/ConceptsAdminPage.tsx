import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { AlertTriangle } from 'lucide-react'

import { supabaseProd } from '../lib/supabase-prod'

type Concept = { slug: string; name: string; description?: string; sort_order: number }
type Draft = { slug: string; name: string; description: string; sort_order: string }

const BLANK: Draft = { slug: '', name: '', description: '', sort_order: '' }

// ── Delete modal state ────────────────────────────────────────────────────────

type DeleteModal =
  | { phase: 'checking'; slug: string; name: string }
  | { phase: 'safe';     slug: string; name: string }
  | { phase: 'inuse';    slug: string; name: string; count: number; target: string }
  | { phase: 'working' }

export function ConceptsAdminPage(): JSX.Element {
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(BLANK)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Concept | null>(null)
  const [editDraft, setEditDraft] = useState<{ name: string; description: string; sort_order: string }>({
    name: '', description: '', sort_order: '',
  })
  const [deleteModal, setDeleteModal] = useState<DeleteModal | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function load(): Promise<void> {
    const { data, error: err } = await supabaseProd
      .from('concepts')
      .select('slug,name,description,sort_order')
      .is('deleted_at', null)
      .order('sort_order')
    if (err) { setError(err.message); setLoading(false); return }
    setConcepts((data ?? []) as Concept[])
    setLoading(false)
  }

  useEffect(() => {
    void (async () => {
      await load()
    })()
  }, [])

  async function handleAdd(): Promise<void> {
    if (!draft.slug.trim() || !draft.name.trim()) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabaseProd.from('concepts').upsert({
      slug: draft.slug.trim(),
      name: draft.name.trim(),
      description: draft.description.trim() || null,
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
    const { error: err } = await supabaseProd.from('concepts').update({
      name: editDraft.name.trim(),
      description: editDraft.description.trim() || null,
      sort_order: parseInt(editDraft.sort_order || '0', 10),
    }).eq('slug', editing.slug)
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditing(null)
    void load()
  }

  async function openDeleteModal(c: Concept): Promise<void> {
    setDeleteError(null)
    setDeleteModal({ phase: 'checking', slug: c.slug, name: c.name })
    // Check both lesson-level concept AND question-level concept usage in parallel.
    // A lesson where only questions (not the lesson itself) use the slug would be
    // missed by the lesson-level check alone — that's the gap that left 34 questions
    // pointing at a deleted concept during M3 testing.
    const [lessonRes, questionRes] = await Promise.all([
      supabaseProd
        .from('content_published')
        .select('content_id', { count: 'exact', head: true })
        .eq('content_type', 'lesson')
        .eq('content->>concept', c.slug),
      supabaseProd
        .from('content_published')
        .select('content_id', { count: 'exact', head: true })
        .eq('content_type', 'lesson')
        .filter('content->questions', 'cs', JSON.stringify([{ concept: c.slug }])),
    ])
    if (lessonRes.error ?? questionRes.error) {
      setDeleteModal(null)
      setError(`Could not check usage: ${(lessonRes.error ?? questionRes.error)!.message}`)
      return
    }
    const n = (lessonRes.count ?? 0) + (questionRes.count ?? 0)
    if (n === 0) {
      setDeleteModal({ phase: 'safe', slug: c.slug, name: c.name })
    } else {
      setDeleteModal({ phase: 'inuse', slug: c.slug, name: c.name, count: n, target: '' })
    }
  }

  async function handleSoftDelete(slug: string): Promise<void> {
    setDeleteModal({ phase: 'working' })
    setDeleteError(null)
    const { error: err } = await supabaseProd
      .from('concepts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('slug', slug)
    if (err) {
      setDeleteError(err.message)
      setDeleteModal(null)
      return
    }
    setDeleteModal(null)
    void load()
  }

  async function handleReassignAndDelete(fromSlug: string, toSlug: string): Promise<void> {
    if (!toSlug) return
    setDeleteModal({ phase: 'working' })
    setDeleteError(null)
    const { error: err } = await supabaseProd.functions.invoke('reassign-concept', {
      body: { from_slug: fromSlug, to_slug: toSlug },
    })
    if (err) {
      setDeleteError(err.message)
      setDeleteModal(null)
      return
    }
    setDeleteModal(null)
    void load()
  }

  const otherConcepts = deleteModal && 'slug' in deleteModal
    ? concepts.filter((c) => c.slug !== deleteModal.slug)
    : concepts

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-ink">Concept Vocabulary</h1>
      {error && <p className="text-sm text-error">{error}</p>}
      {deleteError && <p className="text-sm text-error">{deleteError}</p>}

      {/* Add new concept */}
      <div className="bg-surface rounded-xl border border-line p-4 space-y-3">
        <p className="text-xs font-semibold text-ink-2 uppercase tracking-widest">Add concept</p>
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
        <input
          type="text"
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          placeholder="Description shown as tooltip in dropdowns (optional)"
          className="w-full bg-canvas border border-line rounded px-3 py-2 text-sm text-ink outline-none focus:border-link"
        />
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
            <div key={c.slug} className="p-3 space-y-1">
              {editing?.slug === c.slug ? (
                <div className="space-y-2">
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
                  <input
                    type="text"
                    value={editDraft.description}
                    onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                    placeholder="Description (optional)"
                    className="w-full bg-canvas border border-line rounded px-2 py-1 text-sm text-ink outline-none focus:border-link ml-0"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs text-ink-3 w-32 shrink-0">{c.slug}</span>
                    <div className="min-w-0">
                      <span className="text-sm text-ink">{c.name}</span>
                      {c.description && (
                        <p className="text-xs text-ink-3 truncate mt-0.5">{c.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-ink-3 shrink-0">#{c.sort_order}</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(c)
                        setEditDraft({ name: c.name, description: c.description ?? '', sort_order: String(c.sort_order) })
                      }}
                      className="text-xs px-2 py-1 rounded bg-surface hover:bg-surface-raised text-ink-2"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void openDeleteModal(c)}
                      className="text-xs px-2 py-1 rounded bg-surface hover:bg-error/20 text-error"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-xl border border-line shadow-xl max-w-md w-full p-6 space-y-4">
            {deleteModal.phase === 'checking' && (
              <>
                <p className="font-semibold text-ink">Checking usage…</p>
                <p className="text-sm text-ink-2">
                  Looking up how many lessons are tagged with <span className="font-mono">{deleteModal.name}</span>.
                </p>
              </>
            )}

            {deleteModal.phase === 'safe' && (
              <>
                <p className="font-semibold text-ink">Delete "{deleteModal.name}"?</p>
                <p className="text-sm text-ink-2">
                  No published lessons are tagged with this concept. It will be soft-deleted and removed from all dropdowns.
                </p>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModal(null)}
                    className="text-sm px-4 py-2 rounded bg-surface border border-line text-ink-2 hover:bg-surface-raised"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSoftDelete(deleteModal.slug)}
                    className="text-sm px-4 py-2 rounded bg-error text-white hover:opacity-90"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}

            {deleteModal.phase === 'inuse' && (
              <>
                <div className="flex gap-3 items-start">
                  <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-ink">
                      "{deleteModal.name}" is in use
                    </p>
                    <p className="text-sm text-ink-2">
                      {deleteModal.count} published lesson{deleteModal.count !== 1 ? 's' : ''}{' '}
                      {deleteModal.count !== 1 ? 'are' : 'is'} tagged with this concept (staging is also updated).
                      Choose a replacement concept to retag all content before deleting.
                    </p>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-ink-2">Reassign content to</label>
                  <select
                    value={deleteModal.target}
                    onChange={(e) =>
                      setDeleteModal((m) =>
                        m && m.phase === 'inuse' ? { ...m, target: e.target.value } : m,
                      )
                    }
                    className="w-full bg-canvas border border-line rounded px-3 py-2 text-sm text-ink outline-none focus:border-link"
                  >
                    <option value="">- pick a concept -</option>
                    {otherConcepts.map((c) => (
                      <option key={c.slug} value={c.slug}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteModal(null)}
                    className="text-sm px-4 py-2 rounded bg-surface border border-line text-ink-2 hover:bg-surface-raised"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!deleteModal.target}
                    onClick={() => void handleReassignAndDelete(deleteModal.slug, deleteModal.target)}
                    className="text-sm px-4 py-2 rounded bg-error text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Reassign & delete
                  </button>
                </div>
              </>
            )}

            {deleteModal.phase === 'working' && (
              <p className="text-sm text-ink-2">Working…</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
