import { useEffect, useState, useRef } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, CheckCircle2, Plus, Trash2, Pencil, DollarSign, Clock, Calendar, ChevronRight } from 'lucide-react'
import { supabaseProd } from '../lib/supabase-prod'

import type { Lesson } from '../../shared/schemas/lesson'
import { fetchAllPublishedLessons } from '../lib/lessons'
import { fetchLessonProgress } from '../lib/progress'
import type { LessonProgress } from '../lib/progress'

type ConceptScore = {
  concept: string
  name: string
  attempts: number
  correct: number
  accuracy: number
  prev_accuracy: number | null
  band: 'not_enough' | 'needs_work' | 'getting_there' | 'solid'
}

const STAKES_OPTIONS = ['$1/2 NLHE', '$1/3 NLHE', '$2/3 NLHE', '$2/5 NLHE', '$5/5 NLHE', 'Other']

// ─── Session logging (M5-05) ──────────────────────────────────────────────────

type SessionLog = {
  id: string
  session_date: string
  stakes: string
  hours: number | null
  result_amount: number
  notes: string | null
}

type SessionForm = {
  session_date: string
  stakes: string
  stakesCustom: string
  hours: string
  result_amount: string
  notes: string
}

const EMPTY_SESSION: SessionForm = {
  session_date: new Date().toISOString().slice(0, 10),
  stakes: '',
  stakesCustom: '',
  hours: '',
  result_amount: '',
  notes: '',
}

function RunningTotalGraph({ sessions }: { sessions: SessionLog[] }): JSX.Element {
  const sorted = [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date))
  const points = sorted.reduce<{ result: number; total: number; date: string }[]>((acc, s) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].total : 0
    acc.push({ result: s.result_amount, total: prev + s.result_amount, date: s.session_date })
    return acc
  }, [])

  const W = 600
  const H = 160
  const pLeft = 60  // room for y-axis labels
  const pRight = 16
  const pTop = 16
  const pBot = 28  // room for x-axis labels

  const totals = points.map((p) => p.total)
  const minVal = Math.min(0, ...totals)
  const maxVal = Math.max(0, ...totals)
  const range = maxVal - minVal || 1

  const toX = (i: number) => pLeft + (i / Math.max(points.length - 1, 1)) * (W - pLeft - pRight)
  const toY = (v: number) => pTop + ((maxVal - v) / range) * (H - pTop - pBot)
  const zeroY = toY(0)

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(p.total).toFixed(1)}`).join(' ')

  const finalTotal = points[points.length - 1]?.total ?? 0
  const fmt = (n: number) => (n >= 0 ? '+' : '') + n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  // Y-axis labels: $0, midpoint, max
  const fmtK = (n: number) => {
    const abs = Math.abs(n)
    const sign = n < 0 ? '-' : ''
    return abs >= 1000 ? `${sign}$${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k` : `${sign}$${abs}`
  }

  // collect distinct y tick values: 0, halfway between min/max if range is big enough, max
  const yTicks: number[] = []
  if (minVal < 0) yTicks.push(minVal)
  yTicks.push(0)
  if (maxVal > 0) yTicks.push(maxVal)

  // x-axis: first and last date
  const fmtDate = (d: string) => {
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  const firstDate = sorted[0]?.session_date
  const lastDate = sorted[sorted.length - 1]?.session_date

  return (
    <div className="card space-y-1">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-base font-bold text-ink">Results over time</p>
          <p className="text-xs text-ink-3">Running total · {sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
        </div>
        <span className={`text-sm font-bold mt-0.5 ${finalTotal >= 0 ? 'text-success' : 'text-error'}`}>{fmt(finalTotal)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }} aria-hidden="true">
        {/* Y-axis tick labels */}
        {yTicks.map((v) => (
          <text
            key={v}
            x={pLeft - 6}
            y={toY(v) + 4}
            textAnchor="end"
            fontSize="18"
            fill="var(--color-ink-3)"
          >
            {fmtK(v)}
          </text>
        ))}
        {/* Zero dashed line */}
        <line
          x1={pLeft} y1={zeroY} x2={W - pRight} y2={zeroY}
          stroke="var(--color-ink-3)" strokeWidth="1" strokeDasharray="5 4" opacity="0.4"
        />
        {/* Running total line */}
        <path d={linePath} fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Session dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={toX(i).toFixed(1)}
            cy={toY(p.total).toFixed(1)}
            r="7"
            fill={p.result >= 0 ? 'var(--color-success)' : 'var(--color-error)'}
            stroke="var(--color-canvas)"
            strokeWidth="2"
          />
        ))}
        {/* X-axis date labels */}
        {firstDate && (
          <text x={toX(0)} y={H - 6} textAnchor="start" fontSize="18" fill="var(--color-ink-3)">{fmtDate(firstDate)}</text>
        )}
        {lastDate && lastDate !== firstDate && (
          <text x={toX(points.length - 1)} y={H - 6} textAnchor="middle" fontSize="18" fill="var(--color-ink-3)">{fmtDate(lastDate)}</text>
        )}
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <span className="flex items-center gap-1.5 text-xs text-ink-3">
          <span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />
          Winning session
        </span>
        <span className="flex items-center gap-1.5 text-xs text-ink-3">
          <span className="w-2.5 h-2.5 rounded-full bg-error inline-block" />
          Losing session
        </span>
      </div>
    </div>
  )
}

function SessionsTab(): JSX.Element {
  const [sessions, setSessions] = useState<SessionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SessionForm>(EMPTY_SESSION)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  async function load(): Promise<void> {
    const { data: { user } } = await supabaseProd.auth.getUser()
    if (!user) return
    const { data } = await supabaseProd
      .from('session_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('session_date', { ascending: false })
    setSessions((data ?? []) as SessionLog[])
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  function set<K extends keyof SessionForm>(key: K, value: string): void {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleAdd(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    const resultNum = parseFloat(form.result_amount)
    if (isNaN(resultNum)) { setError('Enter a valid result amount (negative for a loss).'); return }
    setSaving(true)
    const { data: { user } } = await supabaseProd.auth.getUser()
    if (!user) { setSaving(false); return }
    const stakesValue = form.stakes === 'Other'
      ? (form.stakesCustom.trim() || null)
      : (form.stakes || null)
    const { error: err } = await supabaseProd.from('session_logs').insert({
      user_id: user.id,
      session_date: form.session_date,
      stakes: stakesValue,
      hours: form.hours ? parseFloat(form.hours) : null,
      result_amount: resultNum,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(EMPTY_SESSION)
    setShowForm(false)
    await load()
  }

  async function handleDelete(id: string): Promise<void> {
    setDeletingId(id)
    await supabaseProd.from('session_logs').delete().eq('id', id)
    setDeletingId(null)
    await load()
  }

  function handleStartEdit(s: SessionLog): void {
    const knownStake = STAKES_OPTIONS.includes(s.stakes ?? '') ? (s.stakes ?? '') : s.stakes ? 'Other' : ''
    setForm({
      session_date: s.session_date,
      stakes: knownStake,
      stakesCustom: knownStake === 'Other' ? (s.stakes ?? '') : '',
      hours: s.hours != null ? String(s.hours) : '',
      result_amount: String(s.result_amount),
      notes: s.notes ?? '',
    })
    setEditingId(s.id)
    setShowForm(false)
    setError(null)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  async function handleUpdate(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!editingId) return
    setError(null)
    const resultNum = parseFloat(form.result_amount)
    if (isNaN(resultNum)) { setError('Enter a valid result amount (negative for a loss).'); return }
    setSaving(true)
    const stakesValue = form.stakes === 'Other'
      ? (form.stakesCustom.trim() || null)
      : (form.stakes || null)
    const { error: err } = await supabaseProd.from('session_logs').update({
      session_date: form.session_date,
      stakes: stakesValue,
      hours: form.hours ? parseFloat(form.hours) : null,
      result_amount: resultNum,
      notes: form.notes.trim() || null,
    }).eq('id', editingId)
    setSaving(false)
    if (err) { setError(err.message); return }
    setForm(EMPTY_SESSION)
    setEditingId(null)
    await load()
  }

  // Running totals
  const totalSessions = sessions.length
  const totalHours = sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)
  const netResult = sessions.reduce((sum, s) => sum + s.result_amount, 0)
  const hourlyResult = totalHours > 0 ? netResult / totalHours : null

  const fmt = (n: number): string =>
    (n >= 0 ? '+' : '') + n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  const fmtHourly = (n: number): string => {
    const rounded = Math.round(n)
    return (rounded >= 0 ? '+' : '') + '$' + Math.abs(rounded) + '/hr'
  }

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      {!loading && totalSessions > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="stat-card">
            <Calendar className="w-6 h-6 text-gold mb-2" />
            <p className="stat-value">{totalSessions}</p>
            <p className="stat-label">Sessions</p>
          </div>
          <div className="stat-card">
            <Clock className="w-6 h-6 text-gold mb-2" />
            <p className="stat-value">{totalHours.toFixed(1)}h</p>
            <p className="stat-label">Hours played</p>
          </div>
          <div className="stat-card">
            <DollarSign className={`w-6 h-6 mb-2 ${netResult >= 0 ? 'text-success' : 'text-error'}`} />
            <p className={`stat-value ${netResult >= 0 ? 'text-success' : 'text-error'}`}>{fmt(netResult)}</p>
            <p className="stat-label">Net result</p>
          </div>
          <div className="stat-card">
            <TrendingUp className={`w-6 h-6 mb-2 ${hourlyResult !== null && hourlyResult >= 0 ? 'text-success' : hourlyResult !== null ? 'text-error' : 'text-gold'}`} />
            <p className={`stat-value ${hourlyResult !== null && hourlyResult >= 0 ? 'text-success' : hourlyResult !== null ? 'text-error' : ''}`}>
              {hourlyResult !== null ? fmtHourly(hourlyResult) : '-'}
            </p>
            <p className="stat-label">Hourly result</p>
          </div>
        </div>
      )}

      {/* Running total graph - shown from 3 sessions (6.7-6.11) */}
      {!loading && totalSessions >= 3 && <RunningTotalGraph sessions={sessions} />}
      {!loading && totalSessions > 0 && totalSessions < 3 && (
        <p className="text-sm text-ink-3 text-center py-2">
          Log {3 - totalSessions} more session{3 - totalSessions !== 1 ? 's' : ''} to see your results graph.
        </p>
      )}

      {/* Log a session */}
      <div className="card space-y-4">
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-ink">Your Live Sessions</h2>
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setEditingId(null); setError(null) }}
            className="btn-primary w-full flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Log a session
          </button>
        </div>

        {editingId && (
          <div ref={formRef} className="border border-gold/30 rounded-xl p-4 bg-surface-overlay space-y-3">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wide">Edit session</p>
            <form onSubmit={(e) => void handleUpdate(e)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input" value={form.session_date} onChange={(e) => set('session_date', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="label">Stakes</label>
                  <select className="input" value={form.stakes} onChange={(e) => set('stakes', e.target.value)}>
                    <option value="">Select stakes…</option>
                    {STAKES_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  {form.stakes === 'Other' && (
                    <input type="text" className="input" value={form.stakesCustom} onChange={(e) => set('stakesCustom', e.target.value)} placeholder="Describe your game…" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Hours played</label>
                  <input type="number" step="0.5" min="0" className="input" value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="2.5" />
                </div>
                <div>
                  <label className="label">Result ($)</label>
                  <input type="number" step="0.01" className="input" value={form.result_amount} onChange={(e) => set('result_amount', e.target.value)} placeholder="-25 or +120" required />
                </div>
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Key hands, reads, mistakes…" />
              </div>
              {error && <p className="text-sm text-error">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_SESSION); setError(null) }} className="btn-ghost btn-sm flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary btn-sm flex-1">{saving ? 'Saving…' : 'Update session'}</button>
              </div>
            </form>
          </div>
        )}

        {showForm && (
          <div ref={formRef} className="border border-line rounded-xl p-4 bg-surface-overlay space-y-3">
            <form onSubmit={(e) => void handleAdd(e)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={form.session_date}
                    onChange={(e) => set('session_date', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="label">Stakes</label>
                  <select
                    className="input"
                    value={form.stakes}
                    onChange={(e) => set('stakes', e.target.value)}
                  >
                    <option value="">Select stakes…</option>
                    {STAKES_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {form.stakes === 'Other' && (
                    <input
                      type="text"
                      className="input"
                      value={form.stakesCustom}
                      onChange={(e) => set('stakesCustom', e.target.value)}
                      placeholder="Describe your game…"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Hours played</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    className="input"
                    value={form.hours}
                    onChange={(e) => set('hours', e.target.value)}
                    placeholder="2.5"
                  />
                </div>
                <div>
                  <label className="label">Result ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input"
                    value={form.result_amount}
                    onChange={(e) => set('result_amount', e.target.value)}
                    placeholder="-25 or +120"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea
                  className="input resize-none"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Key hands, reads, mistakes…"
                />
              </div>
              {error && <p className="text-sm text-error">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setError(null) }}
                  className="btn-ghost btn-sm flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary btn-sm flex-1">
                  {saving ? 'Saving…' : 'Save session'}
                </button>
              </div>
            </form>
          </div>
        )}

        {loading && <p className="text-sm text-ink-3">Loading…</p>}

        {!loading && sessions.length === 0 && (
          <p className="text-sm text-ink-3 py-4 text-center">No sessions logged yet.</p>
        )}

        {!loading && sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="p-3 rounded-xl bg-canvas space-y-1.5">
                {/* Row 1: date + result */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-ink">
                    {new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span className={`text-sm font-bold shrink-0 ${s.result_amount >= 0 ? 'text-success' : 'text-error'}`}>
                    {fmt(s.result_amount)}
                  </span>
                </div>
                {/* Row 2: stakes chip + hours + edit + trash */}
                <div className="flex items-center gap-2">
                  {s.stakes && <span className="badge-muted">{s.stakes}</span>}
                  {s.hours != null && (
                    <span className="text-xs text-ink-3">{s.hours}h</span>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(s)}
                      className="p-1 rounded-lg text-ink-3 hover:text-gold hover:bg-gold/10 transition-colors"
                      aria-label="Edit session"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (confirm('Delete this session?')) void handleDelete(s.id) }}
                      disabled={deletingId === s.id}
                      className="p-1 rounded-lg text-ink-3 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-40"
                      aria-label="Delete session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Row 3: notes */}
                {s.notes && (
                  <p className="text-xs text-ink-3 leading-relaxed">{s.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── StatsPage with tab switcher ─────────────────────────────────────────────

type StatsTab = 'training' | 'sessions'

export function StatsPage(): JSX.Element {
  const [tab, setTab] = useState<StatsTab>('training')
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({})
  const [loading, setLoading] = useState(true)
  const [conceptScores, setConceptScores] = useState<ConceptScore[] | null>(null)
  const [conceptScoresLoading, setConceptScoresLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAllPublishedLessons(), fetchLessonProgress()])
      .then(([allLessons, progressRows]) => {
        setLessons(allLessons)
        const map: Record<string, LessonProgress> = {}
        for (const row of progressRows) map[row.lessonId] = row
        setProgressMap(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const { data, error } = await supabaseProd.rpc('get_all_concept_scores')
        if (error) { setConceptScores([]); return }
        setConceptScores(((data ?? []) as ConceptScore[]).filter((s) => s.concept !== 'test'))
      } catch {
        setConceptScores([])
      } finally {
        setConceptScoresLoading(false)
      }
    })()
  }, [])


  const attempted = lessons.filter((l) => l.lesson_id && progressMap[l.lesson_id])
  const totalAnswered = attempted.reduce(
    (sum, l) => sum + (l.lesson_id ? (progressMap[l.lesson_id]?.questionsAnswered ?? 0) : 0),
    0,
  )
  const totalCorrect = attempted.reduce(
    (sum, l) => sum + (l.lesson_id ? (progressMap[l.lesson_id]?.questionsCorrect ?? 0) : 0),
    0,
  )
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  const solidCount = conceptScores ? conceptScores.filter((s) => s.band === 'solid').length : null
  const totalMeasured = conceptScores ? conceptScores.filter((s) => s.band !== 'not_enough').length : null

  const recentLessons = attempted
    .filter((l) => l.lesson_id && progressMap[l.lesson_id]?.completed)
    .slice(0, 5)
    .map((l) => ({ lesson: l, progress: l.lesson_id ? progressMap[l.lesson_id] : undefined }))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-2">Stats</h1>
        <p className="text-lg text-ink-2">Track your poker knowledge and results</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('training')}
          className={tab === 'training' ? 'chip-active' : 'chip-inactive'}
        >
          Training
        </button>
        <button
          type="button"
          onClick={() => setTab('sessions')}
          className={tab === 'sessions' ? 'chip-active' : 'chip-inactive'}
        >
          Your Live Sessions
        </button>
      </div>

      {tab === 'sessions' && <SessionsTab />}

      {tab === 'training' && (<>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="stat-card">
          <CheckCircle2 className="w-6 h-6 text-ink-3 mb-2" />
          <p className="stat-value text-ink">{solidCount !== null ? solidCount : '-'}</p>
          <p className="stat-label">Concepts Solid</p>
          {solidCount !== null && totalMeasured !== null && totalMeasured > 0 && (
            <p className="text-xs text-ink-3 mt-1">{solidCount} of {totalMeasured}</p>
          )}
        </div>
        <div className="stat-card">
          <TrendingUp className="w-6 h-6 text-ink-3 mb-2" />
          <p className={`stat-value ${overallAccuracy >= 75 ? 'text-success' : overallAccuracy >= 50 ? 'text-warning' : overallAccuracy > 0 ? 'text-error' : 'text-ink'}`}>
            {overallAccuracy > 0 ? `${overallAccuracy}%` : '-'}
          </p>
          <p className="stat-label">Overall Accuracy</p>
        </div>
      </div>

      {/* How you're doing */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">How you're doing</h2>
          <p className="text-xs text-ink-3 mt-1 leading-relaxed">
            Your weakest concepts are listed first. Each score comes from your last 50 answers in that concept, over the past 90 days. Hit 75% or higher to mark a concept Solid - your goal is to get every one there. Start at the top.
          </p>
        </div>

        {conceptScoresLoading && (
          <p className="text-sm text-ink-3">Analyzing your answer history…</p>
        )}

        {!conceptScoresLoading && conceptScores !== null && (() => {
          const measured = conceptScores.filter((s) => s.band !== 'not_enough')
          const solidCount = conceptScores.filter((s) => s.band === 'solid').length
          const totalMeasured = measured.length

          const bandSections: { band: ConceptScore['band']; label: string; sub: string; subMobile: string; color: string; barColor: string }[] = [
            { band: 'needs_work',    label: 'Needs the most work', sub: 'Your biggest leaks. Fix these first - click a concept to practice',  subMobile: 'Your biggest leaks. Fix these first - tap a concept to practice', color: 'text-error',   barColor: 'bg-error'   },
            { band: 'getting_there', label: 'Getting there',        sub: 'Keep practicing - get your score above 75%',                         subMobile: 'Keep practicing - get your score above 75%',                        color: 'text-warning', barColor: 'bg-warning' },
            { band: 'solid',         label: 'Solid',                sub: 'Nice work. Scores only count the last 90 days - keep practicing to stay sharp', subMobile: 'Nice work. Scores only count the last 90 days - keep practicing to stay sharp', color: 'text-success', barColor: 'bg-success' },
            { band: 'not_enough',    label: 'Not enough answers yet', sub: 'Answer at least 8 questions in a concept to get a score.', subMobile: 'Answer at least 8 questions in a concept to get a score.', color: 'text-ink-3', barColor: 'bg-elevated' },
          ]

          let rank = 0

          return (
            <div className="space-y-5">
              {/* Running count */}
              <p className="text-sm font-medium text-ink-2">
                Right now: {solidCount} of {totalMeasured > 0 ? totalMeasured : 0} concepts solid
              </p>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
                <span><span className="text-error font-semibold">Weak</span> 0–49%</span>
                <span><span className="text-warning font-semibold">Needs work</span> 50–74%</span>
                <span><span className="text-success font-semibold">Solid</span> 75%+</span>
              </div>

              {bandSections.map(({ band, label, sub, subMobile, color, barColor }) => {
                const rows = conceptScores.filter((s) => s.band === band)
                if (rows.length === 0) return null
                return (
                  <div key={band} className="space-y-3">
                    <div>
                      <p className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</p>
                      <p className="text-xs text-ink-3 mt-0.5 hidden sm:block">{sub}</p>
                      <p className="text-xs text-ink-3 mt-0.5 sm:hidden">{subMobile}</p>
                    </div>
                    {rows.map((s) => {
                      const pct = Math.round(s.accuracy * 100)
                      const prevPct = s.prev_accuracy != null ? Math.round(s.prev_accuracy * 100) : null
                      const delta = prevPct !== null ? pct - prevPct : null
                      const isMeasured = band !== 'not_enough'
                      if (isMeasured) rank++
                      const rowRank = isMeasured ? rank : null

                      const rowInner = (
                        <div className="space-y-1">
                          {/* Name row: pct% and mobile chevron sit on the same line as the name */}
                          <div className="flex items-center gap-2">
                            {rowRank !== null
                              ? <span className="text-xs font-bold text-ink-3 w-5 shrink-0 tabular-nums">{rowRank}</span>
                              : <span className="w-5 shrink-0" />
                            }
                            <span className="text-sm font-medium text-ink flex-1 min-w-0 truncate">{s.name}</span>
                            {!isMeasured && (
                              <span className="text-xs text-ink-3 shrink-0">
                                {s.attempts > 0 ? `${s.attempts} answer${s.attempts !== 1 ? 's' : ''} so far` : 'not started'}
                              </span>
                            )}
                            {isMeasured && (
                              <span className="text-base font-bold shrink-0 text-ink">{pct}%</span>
                            )}
                          </div>

                          {isMeasured && (
                            <div className="ml-7 space-y-1">
                              <div className="relative h-2 rounded-full overflow-visible" style={{ background: 'var(--progress-track-bg)' }}>
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${pct}%` }}
                                />
                                <div
                                  className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-ink-3/60 rounded-full"
                                  style={{ left: '75%' }}
                                />
                              </div>

                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-[13px] text-ink-3">
                                  {s.correct} right in your last {s.attempts} answers
                                </span>
                                {delta === null ? (
                                  <span className="text-[13px] text-ink-3">first score</span>
                                ) : delta > 0 ? (
                                  <span className="text-[13px] text-success">up from {prevPct}%</span>
                                ) : delta < 0 ? (
                                  <span className="text-[13px] text-error">down from {prevPct}%</span>
                                ) : (
                                  <span className="text-[13px] text-ink-3">no change</span>
                                )}
                              </div>

                              {/* Mobile tap CTA */}
                              <span className="flex items-center gap-0.5 text-xs font-semibold text-ink-2 sm:hidden">
                                Tap to practice <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          )}
                        </div>
                      )

                      return isMeasured ? (
                        <Link
                          key={s.concept}
                          to={`/play/lessons?concept=${s.concept}`}
                          className="group flex items-start gap-4 rounded-lg px-2 py-1.5 -mx-2 hover:bg-elevated transition-colors"
                        >
                          <div className="flex-1 min-w-0">{rowInner}</div>
                          {/* Offset by the name-row height so this sits level with the bar */}
                          <span className="hidden sm:flex items-center gap-0.5 mt-6 text-xs font-semibold text-ink-2 group-hover:text-gold transition-colors shrink-0">
                            Practice <ChevronRight className="w-3 h-3" />
                          </span>
                          <ChevronRight className="w-4 h-4 mt-6 text-ink-3 shrink-0 sm:hidden" />
                        </Link>
                      ) : (
                        <div key={s.concept} className="px-2 py-1.5 -mx-2">
                          {rowInner}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Recent Lessons - full width */}
      {!loading && recentLessons.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-ink mb-4">Recent Lessons</h2>
          <div className="space-y-1">
            {recentLessons.map(({ lesson, progress }) => {
              const accuracy = progress && progress.questionsAnswered > 0
                ? Math.round((progress.questionsCorrect / progress.questionsAnswered) * 100)
                : null
              const badgeColor = accuracy !== null
                ? accuracy >= 75 ? 'bg-success/20 text-success'
                : accuracy >= 50 ? 'bg-warning/20 text-warning'
                : 'bg-error/20 text-error'
                : 'bg-elevated text-ink-3'
              return lesson.lesson_id ? (
                <Link
                  key={lesson.lesson_id}
                  to={`/play/lessons/${lesson.lesson_id}`}
                  className="group flex items-center gap-3 p-3 rounded-xl hover:bg-elevated transition-colors"
                >
                  {/* Score circle */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${badgeColor}`}>
                    {accuracy !== null ? `${accuracy}%` : '–'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink leading-snug line-clamp-2">{lesson.title}</p>
                    <p className="text-xs text-ink-3 mt-0.5">
                      {lesson.difficulty ? lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1) : 'General'} · {lesson.questions.length} questions
                    </p>
                    {/* Mobile tap CTA */}
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-ink-2 mt-0.5 sm:hidden">
                      Tap to practice again <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                  {/* Desktop: always-visible Practice again > */}
                  <span className="hidden sm:flex items-center gap-0.5 text-xs text-ink-3 group-hover:text-gold transition-colors shrink-0">
                    Practice again <ChevronRight className="w-3 h-3" />
                  </span>
                  {/* Mobile: chevron only */}
                  <ChevronRight className="w-4 h-4 text-ink-3 shrink-0 sm:hidden" />
                </Link>
              ) : (
                <div
                  key={lesson.lesson_id ?? lesson.title}
                  className="flex items-center gap-3 p-3 rounded-xl"
                >
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ${badgeColor}`}>
                    {accuracy !== null ? `${accuracy}%` : '–'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink leading-snug line-clamp-2">{lesson.title}</p>
                    <p className="text-xs text-ink-3 mt-0.5">
                      {lesson.difficulty ? lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1) : 'General'} · {lesson.questions.length} questions
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!loading && attempted.length === 0 && (
        <div className="card text-center space-y-2 py-8">
          <p className="text-ink font-semibold">No stats yet</p>
          <p className="text-sm text-ink-3">Complete your first lesson to see your progress here.</p>
        </div>
      )}
      </>)}
    </div>
  )
}
