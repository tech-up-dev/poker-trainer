import { useState, useEffect, useRef } from 'react'
import type { JSX } from 'react'
import { Plus, Pencil, Trash2, GripVertical, Check, X } from 'lucide-react'
import { supabaseProd } from '../lib/supabase-prod'
import { fetchUpsellButtonConfig, DEFAULT_UPSELL_CONFIG } from '../lib/upsell-config'
import type { UpsellButtonConfig } from '../lib/upsell-config'

function UpsellButtonSection(): JSX.Element {
  const [config, setConfig] = useState<UpsellButtonConfig>(DEFAULT_UPSELL_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchUpsellButtonConfig().then((cfg) => { setConfig(cfg); setLoading(false) })
  }, [])

  function update<K extends keyof UpsellButtonConfig>(key: K, value: UpsellButtonConfig[K]): void {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  async function handleSave(): Promise<void> {
    setSaving(true)
    setError(null)
    const { error: err } = await supabaseProd
      .from('app_settings')
      .update({ value: config })
      .eq('key', 'unlock_pro_training_button')
    if (err) { setError(err.message); setSaving(false); return }
    setSaved(true)
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-ink-2">Loading…</p>

  return (
    <section className="space-y-4 pt-6 border-t border-line">
      <div>
        <h2 className="text-lg font-semibold text-ink">Upsell Button</h2>
        <p className="text-sm text-ink-3 mt-0.5">Configure the "Unlock Pro Training" button shown to members in the sidebar.</p>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Page header */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Page header</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Eyebrow</label>
              <input
                type="text"
                value={config.page_eyebrow}
                onChange={(e) => update('page_eyebrow', e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-gold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Heading</label>
              <input
                type="text"
                value={config.page_title}
                onChange={(e) => update('page_title', e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-gold"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Subtext</label>
            <input
              type="text"
              value={config.page_subtitle}
              onChange={(e) => update('page_subtitle', e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-gold"
            />
          </div>
        </div>

        {/* Member banner + sidebar button */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Member banner</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Banner text</label>
              <input
                type="text"
                value={config.member_banner}
                onChange={(e) => update('member_banner', e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-gold"
              />
              <p className="text-xs text-ink-3">Shown in the banner to logged-in members on the Pro Training page.</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Sidebar button</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Button title</label>
              <input
                type="text"
                value={config.title}
                onChange={(e) => update('title', e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-gold"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Subtitle</label>
              <input
                type="text"
                value={config.subtitle}
                onChange={(e) => update('subtitle', e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-line bg-canvas text-ink focus:outline-none focus:border-gold"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => update('enabled', e.target.checked)}
                className="w-4 h-4 accent-gold cursor-pointer"
              />
              <span className="text-sm text-ink">Show button to members</span>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-error">
          Save failed: {error}. Ask the back-end developer to add a write policy for admin users on the <code>app_settings</code> table.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-5 py-2 rounded-lg bg-gold text-on-gold font-semibold text-sm hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && <span className="text-sm text-success">Saved successfully.</span>}
      </div>
    </section>
  )
}

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
  cta_text: string
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
  cta_text: 'Order Now',
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

          {/* CTA button text */}
          <div>
            <label className="block text-xs font-semibold text-ink-3 mb-1.5 uppercase tracking-wide">CTA button text</label>
            <input
              className="w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-gold"
              value={form.cta_text}
              onChange={(e) => set('cta_text', e.target.value)}
              placeholder="Order Now"
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
  const [savingOrder, setSavingOrder] = useState(false)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragIndexRef = useRef<number | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabaseProd
      .from('pro_training_courses')
      .select('*')
      .order('sort_order', { ascending: true })
    if (err) { setError(err.message); setLoading(false); return }
    setCourses((data ?? []) as Course[])
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data, error: err } = await supabaseProd
        .from('pro_training_courses')
        .select('*')
        .order('sort_order', { ascending: true })
      if (cancelled) return
      if (err) { setError(err.message); setLoading(false); return }
      setCourses((data ?? []) as Course[])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  async function handleSave(form: CourseForm): Promise<void> {
    // cta_text is omitted until the DB column is added by the BE developer.
    // Remove this destructure once pro_training_courses.cta_text exists.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { cta_text: _cta, ...dbPayload } = form
    if (editingCourse) {
      const { error: err } = await supabaseProd
        .from('pro_training_courses')
        .update(dbPayload)
        .eq('id', editingCourse.id)
      if (err) throw new Error(err.message)
    } else {
      const { error: err } = await supabaseProd
        .from('pro_training_courses')
        .insert({ ...dbPayload, enabled: true })
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

  async function handleReorder(fromIndex: number, toIndex: number): Promise<void> {
    if (fromIndex === toIndex) return
    const reordered = [...courses]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)
    const withOrder = reordered.map((c, i) => ({ ...c, sort_order: i + 1 }))
    setCourses(withOrder)
    setSavingOrder(true)
    await Promise.all(
      withOrder.map((c) =>
        supabaseProd.from('pro_training_courses').update({ sort_order: c.sort_order }).eq('id', c.id)
      )
    )
    setSavingOrder(false)
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
        cta_text: editingCourse.cta_text ?? 'Order Now',
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
        <div>
          <h1 className="text-2xl font-bold text-ink">Pro Training</h1>
          <p className="text-sm text-ink-3 mt-0.5">Manage courses and upsell button shown on the Pro Training page</p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Courses</h2>
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
            {savingOrder && <p className="text-xs text-ink-3">Saving order…</p>}
            {courses.map((course, index) => {
              const accent = TONE_COLORS[course.tone]
              const discount = Math.round((1 - course.member_price / course.list_price) * 100)
              const isDragOver = dragOverId === course.id
              return (
                <div
                  key={course.id}
                  draggable
                  onDragStart={() => { dragIndexRef.current = index }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(course.id) }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={() => {
                    setDragOverId(null)
                    if (dragIndexRef.current !== null) void handleReorder(dragIndexRef.current, index)
                    dragIndexRef.current = null
                  }}
                  onDragEnd={() => { setDragOverId(null); dragIndexRef.current = null }}
                  className="flex items-center gap-4 bg-surface border rounded-xl px-4 py-3 transition-colors"
                  style={{
                    opacity: course.enabled ? 1 : 0.5,
                    borderColor: isDragOver ? 'var(--color-gold)' : 'var(--color-line)',
                    cursor: 'grab',
                  }}
                >
                  {/* Drag handle */}
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

        <UpsellButtonSection />
      </div>
    </>
  )
}
