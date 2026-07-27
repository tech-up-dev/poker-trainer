import { useState, useEffect, useCallback } from 'react'
import type { JSX } from 'react'
import { Plus, Pencil, Trash2, GripVertical, Check, X } from 'lucide-react'
import { supabaseProd } from '../lib/supabase-prod'

type Tone = 'amber' | 'teal' | 'violet' | 'blue'

type Course = {
  id: string
  eyebrow: string
  title: string
  description: string
  list_price: number
  member_price: number
  tone: Tone
  sales_url: string
  sort_order: number
  enabled: boolean
}

type CourseForm = Omit<Course, 'id' | 'enabled'>

const TONE_OPTIONS: Tone[] = ['amber', 'teal', 'violet', 'blue']

const TONE_COLORS: Record<Tone, string> = {
  amber:  '#f5a623',
  teal:   '#34d1bf',
  violet: '#a78bfa',
  blue:   '#4aa3ff',
}

const EMPTY_FORM: CourseForm = {
  eyebrow: '',
  title: '',
  description: '',
  list_price: 199,
  member_price: 119,
  tone: 'amber',
  sales_url: '',
  sort_order: 0,
}

function CourseFormModal({
  initial,
  onSave,
  onClose,
}: {
  initial: CourseForm | null
  onSave: (form: CourseForm) => Promise<void>
  onClose: () => void
}): JSX.Element {
  const [form, setForm] = useState<CourseForm>(initial ?? EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof CourseForm>(key: K, value: CourseForm[K]): void {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(form)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-surface border border-line rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="text-base font-bold text-ink">
            {initial ? 'Edit course' : 'Add course'}
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-overlay text-ink-3 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
          {/* Eyebrow */}
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1.5 uppercase tracking-wide">Eyebrow</label>
            <input
              className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-gold"
              value={form.eyebrow}
              onChange={(e) => set('eyebrow', e.target.value)}
              placeholder="3-Betting"
              required
            />
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1.5 uppercase tracking-wide">Title</label>
            <input
              className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-gold"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Advanced 3-Betting Mastery"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1.5 uppercase tracking-wide">Description</label>
            <textarea
              className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-gold resize-none"
              rows={3}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              required
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-3 mb-1.5 uppercase tracking-wide">List price ($)</label>
              <input
                type="number"
                min={1}
                className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-gold"
                value={form.list_price}
                onChange={(e) => set('list_price', Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-3 mb-1.5 uppercase tracking-wide">Member price ($)</label>
              <input
                type="number"
                min={1}
                className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-gold"
                value={form.member_price}
                onChange={(e) => set('member_price', Number(e.target.value))}
                required
              />
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1.5 uppercase tracking-wide">Accent color</label>
            <div className="flex gap-2">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('tone', t)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-colors capitalize"
                  style={{
                    background: form.tone === t ? `${TONE_COLORS[t]}22` : 'transparent',
                    borderColor: form.tone === t ? TONE_COLORS[t] : 'var(--color-line)',
                    color: form.tone === t ? TONE_COLORS[t] : 'var(--color-ink-3)',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Sales URL */}
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1.5 uppercase tracking-wide">Sales page URL</label>
            <input
              className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-gold"
              value={form.sales_url}
              onChange={(e) => set('sales_url', e.target.value)}
              placeholder="https://..."
              required
            />
          </div>

          {/* Sort order */}
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1.5 uppercase tracking-wide">Sort order</label>
            <input
              type="number"
              min={0}
              className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-gold"
              value={form.sort_order}
              onChange={(e) => set('sort_order', Number(e.target.value))}
              required
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-line text-sm font-semibold text-ink-2 hover:text-ink hover:border-ink-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-gold text-on-gold text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ProTrainingAdminPage(): JSX.Element {
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabaseProd
      .from('pro_training_courses')
      .select('*')
      .order('sort_order', { ascending: true })
    if (err) { setError(err.message); setLoading(false); return }
    setCourses((data ?? []) as Course[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function handleSave(form: CourseForm): Promise<void> {
    if (editingCourse) {
      const { error: err } = await supabaseProd
        .from('pro_training_courses')
        .update(form)
        .eq('id', editingCourse.id)
      if (err) throw new Error(err.message)
    } else {
      const { error: err } = await supabaseProd
        .from('pro_training_courses')
        .insert({ ...form, enabled: true })
      if (err) throw new Error(err.message)
    }
    setModalOpen(false)
    setEditingCourse(null)
    await load()
  }

  async function handleToggle(course: Course): Promise<void> {
    setTogglingId(course.id)
    await supabaseProd
      .from('pro_training_courses')
      .update({ enabled: !course.enabled })
      .eq('id', course.id)
    setTogglingId(null)
    await load()
  }

  async function handleDelete(id: string): Promise<void> {
    setDeletingId(id)
    await supabaseProd.from('pro_training_courses').delete().eq('id', id)
    setDeletingId(null)
    await load()
  }

  function openAdd(): void {
    setEditingCourse(null)
    setModalOpen(true)
  }

  function openEdit(course: Course): void {
    setEditingCourse(course)
    setModalOpen(true)
  }

  const formInitial: CourseForm | null = editingCourse
    ? {
        eyebrow: editingCourse.eyebrow,
        title: editingCourse.title,
        description: editingCourse.description,
        list_price: editingCourse.list_price,
        member_price: editingCourse.member_price,
        tone: editingCourse.tone,
        sales_url: editingCourse.sales_url,
        sort_order: editingCourse.sort_order,
      }
    : null

  return (
    <>
      {modalOpen && (
        <CourseFormModal
          initial={formInitial}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingCourse(null) }}
        />
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">Pro Training</h1>
            <p className="text-sm text-ink-3 mt-0.5">Manage courses shown on the Pro Training page</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-gold text-on-gold rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Add course
          </button>
        </div>

        {loading && (
          <p className="text-sm text-ink-3">Loading…</p>
        )}

        {error && (
          <p className="text-sm text-error">{error}</p>
        )}

        {!loading && !error && courses.length === 0 && (
          <div className="text-center py-16 text-ink-3">
            <p className="text-base font-medium">No courses yet</p>
            <p className="text-sm mt-1">Click "Add course" to get started.</p>
          </div>
        )}

        {!loading && courses.length > 0 && (
          <div className="space-y-3">
            {courses.map((course) => {
              const accent = TONE_COLORS[course.tone]
              const discount = Math.round((1 - course.member_price / course.list_price) * 100)
              return (
                <div
                  key={course.id}
                  className="flex items-center gap-4 bg-surface border border-line rounded-xl px-4 py-3"
                  style={{ opacity: course.enabled ? 1 : 0.5 }}
                >
                  {/* Drag handle (visual only) */}
                  <GripVertical className="w-4 h-4 text-ink-3 shrink-0 cursor-grab" />

                  {/* Tone dot */}
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: accent }} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: accent }}>{course.eyebrow}</p>
                    <p className="text-sm font-semibold text-ink truncate">{course.title}</p>
                    <p className="text-xs text-ink-3 mt-0.5">
                      ${course.list_price} → ${course.member_price} ({discount}% off) · sort {course.sort_order}
                    </p>
                  </div>

                  {/* Enabled badge */}
                  <button
                    type="button"
                    onClick={() => void handleToggle(course)}
                    disabled={togglingId === course.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40"
                    style={course.enabled
                      ? { color: accent, borderColor: `${accent}44`, background: `${accent}14` }
                      : { color: 'var(--color-ink-3)', borderColor: 'var(--color-line)', background: 'transparent' }
                    }
                  >
                    {course.enabled
                      ? <><Check className="w-3 h-3" /> Enabled</>
                      : <>Hidden</>
                    }
                  </button>

                  {/* Actions */}
                  <button
                    type="button"
                    onClick={() => openEdit(course)}
                    className="p-1.5 rounded-lg text-ink-3 hover:text-ink hover:bg-surface-overlay transition-colors"
                    aria-label="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (confirm(`Delete "${course.title}"?`)) void handleDelete(course.id) }}
                    disabled={deletingId === course.id}
                    className="p-1.5 rounded-lg text-ink-3 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-40"
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
