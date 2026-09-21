import { useEffect, useState, useRef } from 'react'
import type { JSX } from 'react'
import { TrendingUp, CheckCircle2, Flame, CheckCircle, XCircle, Zap, Plus, Trash2, DollarSign, Clock, Calendar, ArrowUp, ArrowDown } from 'lucide-react'
import { supabaseProd } from '../lib/supabase-prod'

import type { Lesson } from '../../shared/schemas/lesson'
import { fetchAllPublishedLessons } from '../lib/lessons'
import { fetchLessonProgress } from '../lib/progress'
import type { LessonProgress } from '../lib/progress'
import { fetchStreak } from '../lib/streak'

type ConceptScore = {
  concept: string
  name: string
  attempts: number
  correct: number
  accuracy: number
  prev_accuracy: number | null
  band: 'not_enough' | 'needs_work' | 'getting_there' | 'solid'
}
import { fetchUserStateRow, fetchUserBadges, BADGE_CATALOGUE } from '../lib/user-state'
import type { UserBadge } from '../lib/user-state'

const DIFFICULTY_ORDER = ['beginner', 'intermediate', 'advanced'] as const
const DIFFICULTY_LABEL: Record<string, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
}

function ProgressRing({
  value,
  size = 80,
  strokeWidth = 8,
  color = 'gold',
}: {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
}): JSX.Element {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  const strokeColor =
    color === 'success' ? 'var(--color-success)'
    : color === 'warning' ? 'var(--color-warning)'
    : color === 'error'   ? 'var(--color-error)'
    : 'var(--color-gold)'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-elevated)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke={strokeColor}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-ink">{value}%</span>
      </div>
    </div>
  )
}

type DifficultyStats = {
  difficulty: string
  total: number
  completed: number
  questionsAnswered: number
  questionsCorrect: number
}

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
  hours: string
  result_amount: string
  notes: string
}

const EMPTY_SESSION: SessionForm = {
  session_date: new Date().toISOString().slice(0, 10),
  stakes: '',
  hours: '',
  result_amount: '',
  notes: '',
}

function SessionsTab(): JSX.Element {
  const [sessions, setSessions] = useState<SessionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SessionForm>(EMPTY_SESSION)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
    const { error: err } = await supabaseProd.from('session_logs').insert({
      user_id: user.id,
      session_date: form.session_date,
      stakes: form.stakes.trim() || null,
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

  // Running totals
  const totalSessions = sessions.length
  const totalHours = sessions.reduce((sum, s) => sum + (s.hours ?? 0), 0)
  const netResult = sessions.reduce((sum, s) => sum + s.result_amount, 0)
  const winSessions = sessions.filter((s) => s.result_amount > 0).length

  const fmt = (n: number): string =>
    (n >= 0 ? '+' : '') + n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

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
            <TrendingUp className="w-6 h-6 text-gold mb-2" />
            <p className="stat-value">
              {totalSessions > 0 ? Math.round((winSessions / totalSessions) * 100) : 0}%
            </p>
            <p className="stat-label">Win rate</p>
          </div>
        </div>
      )}

      {/* Log a session */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-ink">Session log</h2>
          <button
            type="button"
            onClick={() => { setShowForm((v) => !v); setError(null) }}
            className="btn-primary btn-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Log session
          </button>
        </div>

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
                <div>
                  <label className="label">Stakes (e.g. NL10)</label>
                  <input
                    type="text"
                    className="input"
                    value={form.stakes}
                    onChange={(e) => set('stakes', e.target.value)}
                    placeholder="NL10"
                  />
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
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-surface-overlay"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink">{s.session_date}</span>
                    {s.stakes && <span className="badge-muted">{s.stakes}</span>}
                    {s.hours != null && (
                      <span className="text-xs text-ink-3">{s.hours}h</span>
                    )}
                  </div>
                  {s.notes && (
                    <p className="text-xs text-ink-3 mt-0.5 truncate">{s.notes}</p>
                  )}
                </div>
                <span className={`text-sm font-bold shrink-0 ${s.result_amount >= 0 ? 'text-success' : 'text-error'}`}>
                  {fmt(s.result_amount)}
                </span>
                <button
                  type="button"
                  onClick={() => { if (confirm('Delete this session?')) void handleDelete(s.id) }}
                  disabled={deletingId === s.id}
                  className="p-1.5 rounded-lg text-ink-3 hover:text-error hover:bg-error/10 transition-colors disabled:opacity-40 shrink-0"
                  aria-label="Delete session"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
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
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [conceptScores, setConceptScores] = useState<ConceptScore[] | null>(null)
  const [conceptScoresLoading, setConceptScoresLoading] = useState(true)
  const [totalPoints, setTotalPoints] = useState<number | null>(null)
  const [badges, setBadges] = useState<UserBadge[]>([])

  useEffect(() => {
    Promise.all([fetchAllPublishedLessons(), fetchLessonProgress(), fetchStreak()])
      .then(([allLessons, progressRows, streakData]) => {
        setLessons(allLessons)
        const map: Record<string, LessonProgress> = {}
        for (const row of progressRows) map[row.lessonId] = row
        setProgressMap(map)
        setStreak(streakData.current)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const { data, error } = await supabaseProd.rpc('get_all_concept_scores')
        if (error) { setConceptScores([]); return }
        setConceptScores((data ?? []) as ConceptScore[])
      } catch {
        setConceptScores([])
      } finally {
        setConceptScoresLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    Promise.all([fetchUserStateRow(), fetchUserBadges()])
      .then(([stateRow, badgeRows]) => {
        setTotalPoints(stateRow?.totalPoints ?? 0)
        setBadges(badgeRows)
      })
      .catch(() => {})
  }, [])

  const attempted = lessons.filter((l) => l.lesson_id && progressMap[l.lesson_id])
  const completed = attempted.filter((l) => l.lesson_id && progressMap[l.lesson_id]?.completed)
  const totalAnswered = attempted.reduce(
    (sum, l) => sum + (l.lesson_id ? (progressMap[l.lesson_id]?.questionsAnswered ?? 0) : 0),
    0,
  )
  const totalCorrect = attempted.reduce(
    (sum, l) => sum + (l.lesson_id ? (progressMap[l.lesson_id]?.questionsCorrect ?? 0) : 0),
    0,
  )
  const overallAccuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0

  const statCards = [
    { label: 'Streak',    value: `${streak}d`,                                    icon: Flame,        color: 'text-orange-500' },
    { label: 'Completed', value: String(completed.length),                         icon: CheckCircle2, color: 'text-success'    },
    { label: 'Accuracy',  value: `${overallAccuracy}%`,                            icon: TrendingUp,   color: 'text-gold'       },
    { label: 'Points',    value: totalPoints !== null ? String(totalPoints) : '-', icon: Zap,          color: 'text-gold'       },
  ]

  const difficultyStats: DifficultyStats[] = DIFFICULTY_ORDER.map((diff) => {
    const group = lessons.filter((l) => l.difficulty === diff)
    const groupCompleted = group.filter((l) => l.lesson_id && progressMap[l.lesson_id]?.completed).length
    const groupAnswered = group.reduce(
      (sum, l) => sum + (l.lesson_id ? (progressMap[l.lesson_id]?.questionsAnswered ?? 0) : 0),
      0,
    )
    const groupCorrect = group.reduce(
      (sum, l) => sum + (l.lesson_id ? (progressMap[l.lesson_id]?.questionsCorrect ?? 0) : 0),
      0,
    )
    return {
      difficulty: diff,
      total: group.length,
      completed: groupCompleted,
      questionsAnswered: groupAnswered,
      questionsCorrect: groupCorrect,
    }
  }).filter((s) => s.total > 0)

  const recentLessons = attempted
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
          Session log
        </button>
      </div>

      {tab === 'sessions' && <SessionsTab />}

      {tab === 'training' && (<>

      {/* Stat cards */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {statCards.map((s) => (
            <div key={s.label} className="stat-card">
              <s.icon className={`w-6 h-6 ${s.color} mb-2`} />
              <p className="stat-value">{s.value}</p>
              <p className="stat-label">{s.label}</p>
            </div>
          ))}
        </div>
      )}

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

          const bandSections: { band: ConceptScore['band']; label: string; color: string; barColor: string; textColor: string }[] = [
            { band: 'needs_work',    label: 'Needs the most work', color: 'text-error',   barColor: 'bg-error',   textColor: 'text-error' },
            { band: 'getting_there', label: 'Getting there',        color: 'text-warning', barColor: 'bg-warning', textColor: 'text-warning' },
            { band: 'solid',         label: 'Solid',                color: 'text-success', barColor: 'bg-success', textColor: 'text-success' },
            { band: 'not_enough',    label: 'Not enough answers yet', color: 'text-ink-3', barColor: 'bg-elevated', textColor: 'text-ink-3' },
          ]

          let rank = 0

          return (
            <div className="space-y-5">
              {/* Running count */}
              <p className="text-sm font-medium text-ink">
                Right now: <span className="text-success font-bold">{solidCount}</span> of {totalMeasured > 0 ? totalMeasured : 0} concepts Solid
              </p>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
                <span><span className="text-error font-semibold">Weak</span> 0–49%</span>
                <span><span className="text-warning font-semibold">Needs work</span> 50–74%</span>
                <span><span className="text-success font-semibold">Solid</span> 75%+</span>
              </div>

              {bandSections.map(({ band, label, color, barColor, textColor }) => {
                const rows = conceptScores.filter((s) => s.band === band)
                if (rows.length === 0) return null
                return (
                  <div key={band} className="space-y-3">
                    <p className={`text-xs font-bold uppercase tracking-widest ${color}`}>{label}</p>
                    {rows.map((s) => {
                      const pct = Math.round(s.accuracy * 100)
                      const prevPct = s.prev_accuracy != null ? Math.round(s.prev_accuracy * 100) : null
                      const delta = prevPct !== null ? pct - prevPct : null
                      const isMeasured = band !== 'not_enough'
                      if (isMeasured) rank++
                      const rowRank = isMeasured ? rank : null

                      return (
                        <div key={s.concept} className="space-y-1">
                          <div className="flex items-center gap-2">
                            {rowRank !== null
                              ? <span className="text-xs font-bold text-ink-3 w-5 shrink-0 tabular-nums">{rowRank}</span>
                              : <span className="w-5 shrink-0" />
                            }
                            <span className="text-sm font-medium text-ink flex-1 min-w-0 truncate">{s.name}</span>
                            {isMeasured && (
                              <span className={`text-base font-bold shrink-0 ${textColor}`}>{pct}%</span>
                            )}
                          </div>

                          {isMeasured && (
                            <div className="ml-7 space-y-1">
                              {/* Score bar with 75% tick */}
                              <div className="relative h-2 bg-elevated rounded-full overflow-visible">
                                <div
                                  className={`h-full rounded-full ${barColor}`}
                                  style={{ width: `${pct}%` }}
                                />
                                {/* 75% tick mark */}
                                <div
                                  className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-ink-3/60 rounded-full"
                                  style={{ left: '75%' }}
                                />
                              </div>

                              {/* Delta + answer count row */}
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-[13px] text-ink-3">
                                  {s.correct} right in your last {s.attempts} answers
                                </span>
                                {delta === null ? (
                                  <span className="text-[13px] text-ink-3">first score</span>
                                ) : delta > 0 ? (
                                  <span className="flex items-center gap-0.5 text-[13px] text-success">
                                    <ArrowUp className="w-3 h-3" />
                                    up from {prevPct}%
                                  </span>
                                ) : delta < 0 ? (
                                  <span className="flex items-center gap-0.5 text-[13px] text-error">
                                    <ArrowDown className="w-3 h-3" />
                                    down from {prevPct}%
                                  </span>
                                ) : (
                                  <span className="text-[13px] text-ink-3">no change</span>
                                )}
                              </div>
                            </div>
                          )}
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

      {/* Badges */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Badges</h2>
          <p className="text-xs text-ink-3 mt-0.5">Milestone achievements</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BADGE_CATALOGUE.map((badge) => {
            const earned = badges.find((b) => b.slug === badge.slug)
            return (
              <div
                key={badge.slug}
                className={`flex flex-col items-center text-center gap-2 p-3 rounded-xl border transition-colors ${
                  earned
                    ? 'bg-gold/5 border-gold/30'
                    : 'bg-surface border-line opacity-40'
                }`}
              >
                <span className={`text-3xl ${!earned ? 'grayscale' : ''}`}>{badge.emoji}</span>
                <div>
                  <p className={`text-xs font-semibold ${earned ? 'text-ink' : 'text-ink-3'}`}>
                    {badge.name}
                  </p>
                  <p className="text-[11px] text-ink-3 leading-tight mt-0.5">{badge.description}</p>
                  {earned && (
                    <p className="text-[10px] text-gold mt-1">
                      {new Date(earned.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Accuracy by difficulty + Recent lessons - side by side on large screens */}
      {!loading && (difficultyStats.length > 0 || recentLessons.length > 0) && (
        <div className="lg:flex lg:gap-6 space-y-6 lg:space-y-0 lg:items-stretch">

          {difficultyStats.length > 0 && (
            <div className="card lg:w-[35%] lg:shrink-0">
              <h2 className="text-xl font-semibold text-ink mb-4">Accuracy by Difficulty</h2>
              <div className="flex flex-col items-center gap-6 lg:flex-col lg:items-start lg:gap-4">
                {difficultyStats.map((s) => {
                  const accuracy = s.questionsAnswered > 0
                    ? Math.round((s.questionsCorrect / s.questionsAnswered) * 100)
                    : 0
                  const ringColor = accuracy >= 75 ? 'success' : accuracy >= 50 ? 'warning' : 'error'
                  return (
                    <div key={s.difficulty} className="flex flex-col items-center text-center lg:flex-row lg:text-left lg:gap-4">
                      <ProgressRing value={accuracy} color={ringColor} />
                      <div>
                        <p className="text-base font-medium text-ink mt-2 lg:mt-0">
                          {DIFFICULTY_LABEL[s.difficulty]}
                        </p>
                        <p className="text-xs text-ink-3 mt-0.5">
                          {s.completed}/{s.total} lessons
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {recentLessons.length > 0 && (
            <div className="card lg:flex-1">
              <h2 className="text-xl font-semibold text-ink mb-4">Recent Lessons</h2>
              <div className="space-y-3">
                {recentLessons.map(({ lesson, progress }) => {
                  const accuracy = progress && progress.questionsAnswered > 0
                    ? Math.round((progress.questionsCorrect / progress.questionsAnswered) * 100)
                    : null
                  const isComplete = progress?.completed ?? false
                  return (
                    <div
                      key={lesson.lesson_id ?? lesson.title}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-overlay"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          isComplete ? 'bg-success/20' : 'bg-gold/10'
                        }`}>
                          {isComplete
                            ? <CheckCircle className="w-6 h-6 text-success" />
                            : <XCircle className="w-6 h-6 text-gold" />
                          }
                        </div>
                        <div>
                          <p className="font-medium text-ink">{lesson.title}</p>
                          <p className="text-sm text-ink-3">
                            {lesson.difficulty ?? 'General'} · {lesson.questions.length} questions
                          </p>
                        </div>
                      </div>
                      {accuracy !== null && (
                        <span className={`text-sm font-semibold ${
                          accuracy >= 75 ? 'text-success'
                          : accuracy >= 50 ? 'text-warning'
                          : 'text-error'
                        }`}>
                          {accuracy}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
