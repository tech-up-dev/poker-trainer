import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { TrendingUp, CheckCircle2, Flame, BookOpen, CheckCircle, XCircle, TrendingDown, Minus, Zap } from 'lucide-react'

import type { Lesson } from '../../shared/schemas/lesson'
import { fetchAllPublishedLessons } from '../lib/lessons'
import { fetchLessonProgress } from '../lib/progress'
import type { LessonProgress } from '../lib/progress'
import { fetchStreak } from '../lib/streak'
import { fetchLeaks } from '../lib/leaks'
import type { LeakConcept } from '../lib/leaks'
import { fetchConcepts } from '../lib/concepts'
import type { Concept } from '../lib/concepts'
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

export function StatsPage(): JSX.Element {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({})
  const [streak, setStreak] = useState(0)
  const [loading, setLoading] = useState(true)
  const [leaks, setLeaks] = useState<LeakConcept[] | null>(null)
  const [leaksLoading, setLeaksLoading] = useState(true)
  const [concepts, setConcepts] = useState<Concept[]>([])
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
    Promise.all([fetchLeaks(), fetchConcepts()])
      .then(([leakData, conceptData]) => {
        setLeaks(leakData)
        setConcepts(conceptData)
      })
      .catch(() => setLeaks([]))
      .finally(() => setLeaksLoading(false))
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
        <p className="text-lg text-ink-2">Track your poker knowledge growth</p>
      </div>

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

      {/* Where you're leaking */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Where you're leaking</h2>
          <p className="text-xs text-ink-3 mt-0.5">
            Concepts below 75% accuracy · last 90 days · min. 8 attempts
          </p>
        </div>

        {leaksLoading && (
          <p className="text-sm text-ink-3">Analysing your answer history…</p>
        )}

        {/* No data yet - brand new member */}
        {!leaksLoading && leaks === null && (
          <p className="text-sm text-ink-3">
            Not enough data yet. Answer at least 8 questions on a concept to see your weakest areas.
          </p>
        )}

        {/* Nothing leaking - all above threshold */}
        {!leaksLoading && leaks !== null && leaks.length === 0 && (
          <div className="flex items-center gap-3 py-2">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <p className="text-sm text-ink-2">No leaks detected - you're above 75% on every concept. Keep it up!</p>
          </div>
        )}

        {/* Leak rows */}
        {!leaksLoading && leaks !== null && leaks.length > 0 && (
          <div className="space-y-3">
            {leaks.map((leak, i) => {
              const pct      = Math.round(leak.accuracy * 100)
              const prevPct  = leak.prevAccuracy != null ? Math.round(leak.prevAccuracy * 100) : null
              const delta    = prevPct != null ? pct - prevPct : null
              const name     = concepts.find((c) => c.slug === leak.concept)?.name ?? leak.concept
              const barColor = pct < 50 ? 'bg-error' : 'bg-warning'

              return (
                <div key={leak.concept} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-ink-3 w-4 shrink-0">{i + 1}</span>
                      <span className="text-sm font-medium text-ink truncate">{name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {delta !== null && delta !== 0 && (
                        <span className={`flex items-center gap-0.5 text-xs font-medium ${delta > 0 ? 'text-success' : 'text-error'}`}>
                          {delta > 0
                            ? <TrendingUp className="w-3.5 h-3.5" />
                            : <TrendingDown className="w-3.5 h-3.5" />
                          }
                          {delta > 0 ? '+' : ''}{delta}% from {prevPct}%
                        </span>
                      )}
                      {delta === 0 && prevPct !== null && (
                        <span className="flex items-center gap-0.5 text-xs text-ink-3">
                          <Minus className="w-3.5 h-3.5" />
                          no change
                        </span>
                      )}
                      <span className={`text-base font-bold ${pct < 50 ? 'text-error' : 'text-warning'}`}>
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-elevated rounded-full overflow-hidden ml-6">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-ink-3 ml-6">{leak.correct}/{leak.attempts} correct</p>
                </div>
              )
            })}
          </div>
        )}
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

      {!loading && attempted.length === 0 && (
        <div className="card text-center space-y-2 py-8">
          <p className="text-ink font-semibold">No stats yet</p>
          <p className="text-sm text-ink-3">Complete your first lesson to see your progress here.</p>
        </div>
      )}
    </div>
  )
}
