import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import { TrendingUp, CheckCircle2, Flame, Zap, CheckCircle, XCircle } from 'lucide-react'

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

export function StatsPage(): JSX.Element {
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
    </div>
  )
}
