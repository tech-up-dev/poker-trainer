import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'

import type { Lesson } from '../../shared/schemas/lesson'
import { TodaysTip } from '../components/TodaysTip'
import { fetchAllPublishedLessons } from '../lib/lessons'
import { fetchLessonProgress } from '../lib/progress'
import type { LessonProgress } from '../lib/progress'

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: 'text-success',
  intermediate: 'text-brand-400',
  advanced: 'text-error',
}

export function MemberDashboardPage(): JSX.Element {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({})
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchAllPublishedLessons()
      .then(setLessons)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load lessons.')
      })
      .finally(() => setLoading(false))

    fetchLessonProgress()
      .then((rows) => {
        const map: Record<string, LessonProgress> = {}
        for (const row of rows) map[row.lessonId] = row
        setProgressMap(map)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <TodaysTip />

      <div>
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
          Lessons
        </h2>

        {loading && <p className="text-zinc-400 text-sm">Loading lessons…</p>}
        {error && <p className="text-error text-sm">{error}</p>}
        {!loading && !error && lessons.length === 0 && (
          <p className="text-zinc-500 text-sm">No lessons published yet.</p>
        )}

        <div className="space-y-3">
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.lesson_id ?? lesson.title}
              lesson={lesson}
              progress={lesson.lesson_id ? progressMap[lesson.lesson_id] : undefined}
              onStart={() => navigate(`/play/lessons/${lesson.lesson_id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function LessonCard({
  lesson,
  progress,
  onStart,
}: {
  lesson: Lesson
  progress?: LessonProgress
  onStart: () => void
}): JSX.Element {
  const diffColor = lesson.difficulty
    ? (DIFFICULTY_COLOR[lesson.difficulty] ?? 'text-zinc-400')
    : 'text-zinc-400'

  const pct = progress && progress.questionsAnswered > 0
    ? Math.round((progress.questionsCorrect / progress.questionsAnswered) * 100)
    : null

  return (
    <div className="card space-y-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          {lesson.difficulty && (
            <p className={`text-xs font-semibold uppercase tracking-widest ${diffColor}`}>
              {lesson.difficulty}
            </p>
          )}
          {progress && pct !== null && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              progress.completed
                ? 'bg-success/20 text-success'
                : 'bg-brand-500/20 text-brand-400'
            }`}>
              {progress.completed ? `Completed ${pct}%` : `In progress ${pct}%`}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-zinc-100">{lesson.title}</h3>
        {lesson.concept && (
          <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">{lesson.concept}</p>
        )}
      </div>

      {progress && progress.questionsAnswered > 0 && (
        <div className="progress-bar">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress.completed ? 'bg-success' : 'bg-brand-500'
            }`}
            style={{ width: `${pct ?? 0}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {lesson.questions.length} question{lesson.questions.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={onStart}
          className="btn-primary btn-sm"
        >
          {progress?.completed ? 'Retry' : progress ? 'Continue' : 'Start'}
        </button>
      </div>
    </div>
  )
}
