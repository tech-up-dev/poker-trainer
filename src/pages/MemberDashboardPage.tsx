import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import { PlayCircle, Zap, TrendingDown, ChevronRight, BarChart3 } from 'lucide-react'

import type { Lesson } from '../../shared/schemas/lesson'
import { fetchAllPublishedLessons } from '../lib/lessons'
import { fetchLessonProgress } from '../lib/progress'
import type { LessonProgress } from '../lib/progress'
import { fetchLeaks } from '../lib/leaks'
import type { LeakConcept } from '../lib/leaks'
import { fetchConcepts } from '../lib/concepts'
import type { Concept } from '../lib/concepts'
import { TodaysTip } from '../components/TodaysTip'

export function MemberDashboardPage(): JSX.Element {
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({})
  const [loading, setLoading] = useState(true)
  const [leaks, setLeaks] = useState<LeakConcept[] | null>(null)
  const [concepts, setConcepts] = useState<Concept[]>([])

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
    Promise.all([fetchLeaks(), fetchConcepts()])
      .then(([leakData, conceptData]) => {
        setLeaks(leakData)
        setConcepts(conceptData)
      })
      .catch(() => setLeaks([]))
  }, [])

  const sortedLessons = [...lessons].sort((a, b) => (a.seq ?? 9999) - (b.seq ?? 9999))
  const inProgressLesson = sortedLessons.find(
    (l) => l.lesson_id && progressMap[l.lesson_id] && !progressMap[l.lesson_id].completed,
  )
  const nextUnstarted = sortedLessons.find((l) => l.lesson_id && !progressMap[l.lesson_id])
  const continueLesson = inProgressLesson ?? nextUnstarted ?? null
  const allDone = !loading && lessons.length > 0 && !continueLesson

  const continueLessonProgress = continueLesson?.lesson_id
    ? progressMap[continueLesson.lesson_id]
    : undefined
  const continuePct =
    continueLessonProgress && continueLessonProgress.questionsAnswered > 0
      ? Math.round(
          (continueLessonProgress.questionsCorrect / continueLessonProgress.questionsAnswered) * 100,
        )
      : null

  const topLeak = leaks && leaks.length > 0 ? leaks[0] : null
  const topLeakName = topLeak
    ? (concepts.find((c) => c.slug === topLeak.concept)?.name ?? topLeak.concept)
    : null

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Block 1 - Pick up where you left off */}
      <div className="card-elevated">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-3">
          Pick up where you left off
        </p>

        {loading && <p className="text-sm text-ink-3">Loading…</p>}

        {!loading && continueLesson && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-ink mb-1 truncate">{continueLesson.title}</h2>
              <p className="text-sm text-ink-3 mb-3">
                {continueLesson.difficulty ?? 'General'} &middot;{' '}
                {continueLesson.questions.length}{' '}
                {continueLesson.questions.length === 1 ? 'question' : 'questions'}
              </p>
              {continuePct !== null && (
                <div className="space-y-1 max-w-xs">
                  <p className="text-xs text-ink-3">{continuePct}% correct so far</p>
                  <div className="progress-bar w-full">
                    <div className="progress-fill" style={{ width: `${continuePct}%` }} />
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void navigate(`/play/lessons/${continueLesson.lesson_id}`)}
              className="btn-primary btn-lg shrink-0"
            >
              <PlayCircle className="w-5 h-5" />
              {inProgressLesson ? 'Resume' : 'Start'}
            </button>
          </div>
        )}

        {!loading && allDone && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-ink mb-1">All lessons complete!</h2>
              <p className="text-sm text-ink-3">
                You've finished every lesson. Keep sharpening your edge.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void navigate('/play/lessons')}
              className="btn-secondary shrink-0"
            >
              Review lessons
            </button>
          </div>
        )}

        {!loading && lessons.length === 0 && (
          <p className="text-sm text-ink-3">No lessons available yet.</p>
        )}
      </div>

      {/* Block 2 - Where you're leaking + Drill button */}
      <div className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-1.5">
              Where you're leaking
            </p>
            {topLeak && topLeakName ? (
              <div className="flex items-center gap-2 flex-wrap">
                <TrendingDown className="w-4 h-4 text-error shrink-0" />
                <span className="text-base font-semibold text-ink">{topLeakName}</span>
                <span className="text-sm font-medium text-error">
                  {Math.round(topLeak.accuracy * 100)}% correct
                </span>
              </div>
            ) : leaks !== null && leaks.length === 0 ? (
              <p className="text-sm text-ink-2">No leaks - above 75% on all concepts.</p>
            ) : leaks === null ? (
              <p className="text-sm text-ink-3">
                Answer 8+ questions on a concept to see weak spots.
              </p>
            ) : (
              <p className="text-sm text-ink-3">Analysing your history…</p>
            )}
          </div>
          <Link
            to="/play/stats"
            className="text-xs text-ink-3 hover:text-ink flex items-center gap-0.5 shrink-0 pt-0.5"
          >
            See all
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => void navigate('/play/drill')}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          <Zap className="w-4 h-4" />
          Drill my weak spots
        </button>
      </div>

      {/* Block 3 - This month (days progress, wired up in M5-02) */}
      <div className="card">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-widest mb-3">
          This month
        </p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-gold" />
          </div>
          <div>
            <p className="text-base font-semibold text-ink">- of - training days</p>
            <p className="text-xs text-ink-3">Monthly goal coming soon</p>
          </div>
        </div>
      </div>

      {/* Block 4 - Today's Tip (full-width) */}
      <TodaysTip />

    </div>
  )
}
