import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import {
  ChevronRight,
  PlayCircle,
} from 'lucide-react'

import type { Lesson } from '../../shared/schemas/lesson'
import { fetchAllPublishedLessons } from '../lib/lessons'
import { fetchLessonProgress } from '../lib/progress'
import type { LessonProgress } from '../lib/progress'
import { TodaysTip } from '../components/TodaysTip'
import { useAuth } from '../lib/auth-context'

export function MemberDashboardPage(): JSX.Element {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({})
  const [loading, setLoading] = useState(true)

  // Onboarding redirect disabled for staging-dev (M4 feature)
  // useEffect(() => {
  //   if (!isAdmin && !localStorage.getItem('bss_onboarding_done')) {
  //     void navigate('/onboarding', { replace: true })
  //   }
  // }, [isAdmin, navigate])

  useEffect(() => {
    Promise.all([
      fetchAllPublishedLessons(),
      fetchLessonProgress(),
    ]).then(([allLessons, progressRows]) => {
      setLessons(allLessons)
      const map: Record<string, LessonProgress> = {}
      for (const row of progressRows) map[row.lessonId] = row
      setProgressMap(map)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const email = session?.user?.email ?? ''
  const displayName = email.split('@')[0] ?? 'there'

  const inProgress = lessons.filter(
    (l) => l.lesson_id && progressMap[l.lesson_id] && !progressMap[l.lesson_id].completed,
  ).length
  const nextLesson = lessons.find((l) => l.lesson_id && !progressMap[l.lesson_id]?.completed)



  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Welcome header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg text-ink-2">Welcome back,</p>
          <h1 className="text-3xl font-bold text-ink">{displayName}</h1>
        </div>
      {/* Streak badge hidden for staging-dev (M4 feature) */}
      </div>

      {/* Stats grid hidden for staging-dev (M4 feature) */}

      {/* Daily tip */}
      <TodaysTip />

      {/* Continue learning */}
      {!loading && nextLesson && (
        <div className="card-elevated">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-3 mb-1">Continue Learning</p>
              <h3 className="text-xl font-semibold text-ink mb-2">{nextLesson.title}</h3>
              {nextLesson.concept && (
                <p className="text-sm text-ink-2 leading-relaxed line-clamp-2 mb-3">{nextLesson.concept}</p>
              )}
              {(() => {
                const p = nextLesson.lesson_id ? progressMap[nextLesson.lesson_id] : undefined
                if (!p || p.questionsAnswered === 0) return null
                const pct = Math.round((p.questionsCorrect / p.questionsAnswered) * 100)
                return (
                  <div>
                    <p className="text-sm text-ink-3 mb-2">{pct}% complete</p>
                    <div className="progress-bar w-full max-w-xs">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })()}
            </div>
            <button
              type="button"
              onClick={() => navigate(`/play/lessons/${nextLesson.lesson_id}`)}
              className="btn-primary btn-lg shrink-0"
            >
              <PlayCircle className="w-5 h-5" />
              {inProgress > 0 ? 'Resume' : 'Start'}
            </button>
          </div>
        </div>
      )}

      {!loading && !nextLesson && lessons.length > 0 && (
        <div className="card text-center space-y-3">
          <p className="text-2xl">🎉</p>
          <p className="text-base font-semibold text-ink">All lessons complete!</p>
          <p className="text-sm text-ink-2">You've finished every lesson. Keep practising to sharpen your edge.</p>
          <button
            type="button"
            onClick={() => navigate('/play/lessons')}
            className="btn-secondary w-full"
          >
            Review lessons
          </button>
        </div>
      )}

      {/* Lessons preview list */}
      {!loading && lessons.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-ink">Lessons</h2>
            <Link
              to="/play/lessons"
              className="text-gold hover:text-amber text-sm flex items-center gap-1 transition-colors"
            >
              View all
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-1">
            {lessons.slice(0, 4).map((lesson) => {
              const progress = lesson.lesson_id ? progressMap[lesson.lesson_id] : undefined
              const pct = progress && progress.questionsAnswered > 0
                ? Math.round((progress.questionsCorrect / progress.questionsAnswered) * 100)
                : null
              return (
                <button
                  key={lesson.lesson_id ?? lesson.title}
                  type="button"
                  onClick={() => navigate(`/play/lessons/${lesson.lesson_id}`)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-surface-overlay transition-colors group text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-ink truncate">{lesson.title}</p>
                    <p className="text-sm text-ink-3">
                      {lesson.difficulty ?? 'General'} · {lesson.questions.length} questions
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {progress?.completed && (
                      <span className="badge-success">Complete</span>
                    )}
                    {progress && !progress.completed && pct !== null && (
                      <span className="badge-warning">{pct}%</span>
                    )}
                    {!progress && (
                      <span className="badge-muted">Start</span>
                    )}
                    <ChevronRight className="w-5 h-5 text-ink-3 group-hover:text-gold transition-colors" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Learning path nav card */}
      <Link
        to="/play/lessons"
        className="card flex items-center justify-between hover:bg-surface-overlay transition-colors group"
      >
        <div>
          <h2 className="text-xl font-semibold text-ink mb-1">Your Learning Path</h2>
          <p className="text-ink-2 text-sm">Follow a guided curriculum tailored for small stakes</p>
        </div>
        <ChevronRight className="w-6 h-6 text-ink-3 group-hover:text-gold transition-colors shrink-0" />
      </Link>

    </div>
  )
}
