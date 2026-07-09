import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import { Search, ChevronRight, CheckCircle2, Clock } from 'lucide-react'

import type { Lesson } from '../../shared/schemas/lesson'
import { fetchAllPublishedLessons } from '../lib/lessons'
import { fetchLessonProgress } from '../lib/progress'
import type { LessonProgress } from '../lib/progress'

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const
type Difficulty = typeof DIFFICULTIES[number]

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
}

export function LessonsPage(): JSX.Element {
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<Difficulty | null>(null)

  useEffect(() => {
    Promise.all([fetchAllPublishedLessons(), fetchLessonProgress()])
      .then(([allLessons, progressRows]) => {
        setLessons(allLessons)
        const map: Record<string, LessonProgress> = {}
        for (const row of progressRows) map[row.lessonId] = row
        setProgressMap(map)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load lessons.')
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = lessons.filter((l) => {
    const matchesSearch = l.title.toLowerCase().includes(search.toLowerCase())
    const matchesDiff = !activeFilter || l.difficulty === activeFilter
    return matchesSearch && matchesDiff
  })

  const activeDifficulties = activeFilter
    ? [activeFilter]
    : (DIFFICULTIES.filter((d) => filtered.some((l) => l.difficulty === d)))

  const untagged = filtered.filter((l) => !l.difficulty)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink mb-2">Path</h1>
        <p className="text-lg text-ink-2">Build your poker knowledge one hand at a time</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lessons…"
          className="input pl-12"
        />
      </div>

      {/* Difficulty filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
        <button
          type="button"
          onClick={() => setActiveFilter(null)}
          className={activeFilter === null ? 'chip-active' : 'chip-inactive'}
        >
          All
        </button>
        {DIFFICULTIES.filter((d) => lessons.some((l) => l.difficulty === d)).map((diff) => {
          const total = lessons.filter((l) => l.difficulty === diff).length
          const done = lessons.filter(
            (l) => l.difficulty === diff && l.lesson_id && progressMap[l.lesson_id]?.completed,
          ).length
          return (
            <button
              key={diff}
              type="button"
              onClick={() => setActiveFilter(diff)}
              className={activeFilter === diff ? 'chip-active' : 'chip-inactive'}
            >
              {DIFFICULTY_LABEL[diff]}
              <span className="text-xs opacity-70">({done}/{total})</span>
            </button>
          )
        })}
      </div>

      {loading && <p className="text-ink-3 text-sm">Loading lessons…</p>}
      {error && <p className="text-error text-sm">{error}</p>}

      {/* Grouped by difficulty */}
      <div className="space-y-8">
        {activeDifficulties.map((diff) => {
          const group = filtered.filter((l) => l.difficulty === diff)
          if (group.length === 0) return null
          const completed = group.filter(
            (l) => l.lesson_id && progressMap[l.lesson_id]?.completed,
          ).length
          const progress = Math.round((completed / group.length) * 100)

          return (
            <div key={diff} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-ink">{DIFFICULTY_LABEL[diff]}</h2>
                <span className="text-sm text-ink-3">{completed}/{group.length} completed</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>

              <div className="grid gap-3">
                {group.map((lesson) => {
                  const p = lesson.lesson_id ? progressMap[lesson.lesson_id] : undefined
                  const accuracy = p && p.questionsAnswered > 0
                    ? Math.round((p.questionsCorrect / p.questionsAnswered) * 100)
                    : null
                  const pct = p && p.questionsAnswered > 0
                    ? Math.round((p.questionsCorrect / p.questionsAnswered) * 100)
                    : 0

                  return (
                    <button
                      key={lesson.lesson_id ?? lesson.title}
                      type="button"
                      onClick={() => navigate(`/play/lessons/${lesson.lesson_id}`)}
                      className="card flex items-center justify-between hover:bg-surface-overlay transition-colors group text-left w-full overflow-hidden"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          {p?.completed ? (
                            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                          ) : p ? (
                            <Clock className="w-5 h-5 text-gold shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-line shrink-0" />
                          )}
                          <h3 className="text-base font-medium text-ink truncate">{lesson.title}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3 ml-7">
                          <span>{lesson.questions.length} questions</span>
                          {lesson.principle_tag && (
                            <span className="badge-muted">{lesson.principle_tag}</span>
                          )}
                        </div>
                        {p && p.questionsAnswered > 0 && (
                          <div className="progress-bar mt-2 ml-7">
                            <div className="progress-fill" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-3">
                        {accuracy !== null && (
                          <span className="text-sm font-medium text-ink-3">{accuracy}%</span>
                        )}
                        <ChevronRight className="w-5 h-5 text-ink-3 group-hover:text-gold transition-colors" />
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Untagged lessons (no difficulty) */}
        {untagged.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">General</h2>
            <div className="grid gap-3">
              {untagged.map((lesson) => {
                const p = lesson.lesson_id ? progressMap[lesson.lesson_id] : undefined
                return (
                  <button
                    key={lesson.lesson_id ?? lesson.title}
                    type="button"
                    onClick={() => navigate(`/play/lessons/${lesson.lesson_id}`)}
                    className="card flex items-center justify-between hover:bg-surface-overlay transition-colors group text-left w-full overflow-hidden"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {p?.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                        ) : p ? (
                          <Clock className="w-5 h-5 text-gold shrink-0" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-line shrink-0" />
                        )}
                        <h3 className="text-base font-medium text-ink truncate">{lesson.title}</h3>
                      </div>
                      <p className="text-sm text-ink-3 ml-7">{lesson.questions.length} questions</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-ink-3 group-hover:text-gold transition-colors shrink-0 ml-3" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-ink-2">No lessons found</p>
            <p className="text-sm text-ink-3 mt-1">Try a different search or filter</p>
          </div>
        )}
      </div>
    </div>
  )
}
