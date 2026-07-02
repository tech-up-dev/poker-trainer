import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'

import type { Lesson } from '../../shared/schemas/lesson'
import { MemberHeader } from '../components/MemberHeader'
import { TodaysTip } from '../components/TodaysTip'
import { fetchAllPublishedLessons } from '../lib/lessons'

const DIFFICULTY_COLOR: Record<string, string> = {
  beginner: 'text-success',
  intermediate: 'text-gold',
  advanced: 'text-error',
}

export function MemberDashboardPage(): JSX.Element {
  const [lessons, setLessons] = useState<Lesson[]>([])
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
  }, [])

  return (
    <div className="min-h-screen bg-canvas text-ink px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        <MemberHeader />

        <TodaysTip />

        <div>
          <h2 className="text-sm font-semibold text-ink-2 mb-3">Lessons</h2>

          {loading && (
            <p className="text-ink-2 text-sm">Loading lessons…</p>
          )}

          {error && (
            <p className="text-error text-sm">{error}</p>
          )}

          {!loading && !error && lessons.length === 0 && (
            <p className="text-ink-2 text-sm">No lessons published yet.</p>
          )}

          <div className="space-y-3">
            {lessons.map((lesson) => (
              <LessonCard
                key={lesson.lesson_id ?? lesson.title}
                lesson={lesson}
                onStart={() => navigate(`/play/lessons/${lesson.lesson_id}`)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function LessonCard({
  lesson,
  onStart,
}: {
  lesson: Lesson
  onStart: () => void
}): JSX.Element {
  const diffColor = lesson.difficulty
    ? (DIFFICULTY_COLOR[lesson.difficulty] ?? 'text-ink-2')
    : 'text-ink-2'

  return (
    <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
      <div className="space-y-1">
        {lesson.difficulty && (
          <p className={`text-xs font-semibold uppercase tracking-widest ${diffColor}`}>
            {lesson.difficulty}
          </p>
        )}
        <h3 className="text-base font-semibold">{lesson.title}</h3>
        {lesson.concept && (
          <p className="text-sm text-ink-2 leading-relaxed line-clamp-2">{lesson.concept}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-3">
          {lesson.questions.length} question{lesson.questions.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={onStart}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-gold text-on-gold hover:bg-amber transition-colors"
        >
          Start
        </button>
      </div>
    </div>
  )
}
