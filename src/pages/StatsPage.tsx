import { useEffect, useState, useRef } from 'react'
import type { JSX } from 'react'
import { TrendingUp, CheckCircle2, Flame, Zap, CheckCircle, XCircle, Plus, Trash2, DollarSign, Clock, Calendar } from 'lucide-react'
import { supabaseProd } from '../lib/supabase-prod'

import type { Lesson } from '../../shared/schemas/lesson'
import { fetchAllPublishedLessons } from '../lib/lessons'
import { fetchLessonProgress } from '../lib/progress'
import type { LessonProgress } from '../lib/progress'
import { fetchStreak } from '../lib/streak'
import { fetchUserStateRow, fetchUserBadges, BADGE_CATALOGUE } from '../lib/user-state'
import type { EarnedBadge } from '../lib/user-state'

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
  const [totalPoints, setTotalPoints] = useState(0)
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([])
  const [loading, setLoading] = useState(true)

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
    Promise.all([fetchUserStateRow(), fetchUserBadges()])
      .then(([state, badges]) => {
        setTotalPoints(state.totalPoints)
        setEarnedBadges(badges)
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
    { label: 'Streak',    value: `${streak}d`,              icon: Flame,        color: 'text-orange-500' },
    { label: 'Completed', value: String(completed.length),  icon: CheckCircle2, color: 'text-success'    },
    { label: 'Accuracy',  value: `${overallAccuracy}%`,     icon: TrendingUp,   color: 'text-gold'       },
    { label: 'Points',    value: String(totalPoints),        icon: Zap,          color: 'text-gold'       },
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

      {/* Accuracy by difficulty */}
      {!loading && difficultyStats.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-ink mb-4">Accuracy by Difficulty</h2>
          <div className="grid grid-cols-3 gap-6">
            {difficultyStats.map((s) => {
              const accuracy = s.questionsAnswered > 0
                ? Math.round((s.questionsCorrect / s.questionsAnswered) * 100)
                : 0
              const ringColor = accuracy >= 75 ? 'success' : accuracy >= 50 ? 'warning' : 'error'
              return (
                <div key={s.difficulty} className="flex flex-col items-center text-center">
                  <ProgressRing value={accuracy} color={ringColor} />
                  <p className="text-base font-medium text-ink mt-2">
                    {DIFFICULTY_LABEL[s.difficulty]}
                  </p>
                  <p className="text-xs text-ink-3 mt-0.5">
                    {s.completed}/{s.total} lessons
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Badges */}
      {!loading && (
        <div className="card">
          <h2 className="text-xl font-semibold text-ink mb-4">Badges</h2>
          <div className="grid grid-cols-2 gap-3">
            {BADGE_CATALOGUE.map((badge) => {
              const earned = earnedBadges.find((b) => b.slug === badge.slug)
              return (
                <div
                  key={badge.slug}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    earned ? 'bg-gold/10' : 'bg-surface-overlay opacity-50 grayscale'
                  }`}
                >
                  <span className="text-2xl shrink-0">{badge.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${earned ? 'text-ink' : 'text-ink-3'}`}>
                      {badge.label}
                    </p>
                    <p className="text-xs text-ink-3 truncate">
                      {earned
                        ? new Date(earned.earnedAt).toLocaleDateString()
                        : badge.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent lessons */}
      {!loading && recentLessons.length > 0 && (
        <div className="card">
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
                        {lesson.difficulty ?? 'General'} · {lesson.questions.length} question{lesson.questions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  {accuracy !== null && !isComplete && (
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
