import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import type { JSX } from 'react'
import { Search, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'

import type { Lesson } from '../../shared/schemas/lesson'
import { fetchAllPublishedLessons } from '../lib/lessons'
import { fetchLessonProgress } from '../lib/progress'
import type { LessonProgress } from '../lib/progress'
import { fetchSkillsPath } from '../lib/skills-path'
import type { SkillPrinciple, SkillConcept } from '../lib/skills-path'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function accuracyColor(pct: number | null): string {
  if (pct === null) return 'text-ink-3'
  if (pct >= 75) return 'text-success'
  if (pct >= 50) return 'text-warning'
  return 'text-error'
}

function accuracyBadge(pct: number | null): string {
  if (pct === null) return 'bg-surface text-ink-3'
  if (pct >= 75) return 'bg-success/15 text-success'
  if (pct >= 50) return 'bg-warning/15 text-warning'
  return 'bg-error/15 text-error'
}

function PartialRing({ answered, total }: { answered: number; total: number }): JSX.Element {
  const r = 8
  const circumference = 2 * Math.PI * r
  const dash = total > 0 ? Math.min(answered / total, 1) * circumference : 0
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0 -rotate-90">
      <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="2" className="text-line" />
      <circle
        cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="2"
        strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round"
        className="text-ink-3"
      />
    </svg>
  )
}

// ─── Lesson row (3 states) ────────────────────────────────────────────────────

function LessonRow({
  lesson,
  progress,
  titleOverride,
}: {
  lesson: Lesson
  progress: LessonProgress | undefined
  titleOverride?: string
}): JSX.Element {
  const navigate = useNavigate()
  const total = lesson.questions.length
  const answered = progress?.questionsAnswered ?? 0
  const correct = progress?.questionsCorrect ?? 0
  const completed = progress?.completed ?? false
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : null
  const displayTitle = titleOverride ?? lesson.title
  const diffLabel = lesson.difficulty
    ? lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)
    : 'General'

  return (
    <button
      type="button"
      onClick={() => void navigate(`/play/lessons/${lesson.lesson_id}`)}
      className="w-full text-left flex items-start gap-3 p-3 rounded-xl hover:bg-elevated transition-colors group"
    >
      {/* State icon - always neutral */}
      <div className="mt-0.5 shrink-0">
        {completed
          ? <CheckCircle2 className="w-5 h-5 text-ink-3" />
          : answered > 0
          ? <PartialRing answered={answered} total={total} />
          : <div className="w-5 h-5 rounded-full border-2 border-line" />
        }
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-ink line-clamp-2">{displayTitle}</p>
        <p className="text-xs text-ink-3 mt-0.5">
          {diffLabel} · {total} question{total !== 1 ? 's' : ''}
        </p>
        {/* Status line */}
        <p className={`text-xs mt-0.5 ${completed ? accuracyColor(accuracy) : 'text-ink-3'}`}>
          {completed && accuracy !== null
            ? `${accuracy}% correct`
            : answered > 0
            ? `${answered} of ${total} answered`
            : 'Not started'}
        </p>
        {/* Mobile CTA - hidden on sm+ */}
        <p className="text-xs text-ink-3 mt-0.5 sm:hidden">
          {completed ? 'Tap to practice again >' : answered > 0 ? 'Tap to resume >' : 'Tap to start >'}
        </p>
      </div>

      {/* Right side - desktop CTA always visible */}
      <div className="hidden sm:flex items-center gap-1 shrink-0 self-center">
        <span className="text-xs text-ink-3 group-hover:text-gold transition-colors">
          {completed ? 'Practice again' : answered > 0 ? 'Resume' : 'Start'}
        </span>
        <ChevronRight className="w-4 h-4 text-ink-3 group-hover:text-gold transition-colors" />
      </div>
      {/* Mobile chevron only */}
      <ChevronRight className="w-4 h-4 text-ink-3 shrink-0 self-center sm:hidden" />
    </button>
  )
}

// ─── Principle helpers ────────────────────────────────────────────────────────

function principleAvg(p: SkillPrinciple): number {
  const practiced = p.concepts.filter((c) => c.attempts > 0)
  if (practiced.length === 0) return 0
  return Math.round(practiced.reduce((sum, c) => sum + (c.accuracy ?? 0), 0) / practiced.length)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LessonsPage(): JSX.Element {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeConcept = searchParams.get('concept')

  const [skillsPath, setSkillsPath] = useState<SkillPrinciple[] | null>(null)
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([fetchSkillsPath(), fetchAllPublishedLessons(), fetchLessonProgress()])
      .then(([path, allLessons, progressRows]) => {
        setSkillsPath(path)
        setLessons(allLessons)
        const map: Record<string, LessonProgress> = {}
        for (const row of progressRows) map[row.lessonId] = row
        setProgressMap(map)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [location.key])

  // ── Concept sub-page ────────────────────────────────────────────────────────
  if (activeConcept) {
    let conceptData: SkillConcept | null = null
    let principleName = ''
    for (const p of (skillsPath ?? [])) {
      const c = p.concepts.find((c) => c.slug === activeConcept)
      if (c) { conceptData = c; principleName = p.name; break }
    }

    const conceptName = conceptData?.name ?? activeConcept
    const conceptLessons = lessons.filter((l) => l.concept === activeConcept)
    const prefix = conceptName + ': '

    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => setSearchParams({})}
          className="flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Lessons
        </button>

        {loading ? (
          <p className="text-sm text-ink-3">Loading...</p>
        ) : (
          <>
            {/* Concept header (4.14) */}
            <div>
              <h1 className="text-2xl font-bold text-ink">{conceptName}</h1>
              <p className="text-sm text-ink-3 mt-1">
                {principleName}
                {conceptData && conceptData.accuracy !== null && (
                  <>
                    {' · '}
                    <span className={`font-medium ${accuracyColor(conceptData.accuracy)}`}>
                      {conceptData.accuracy}% accuracy
                    </span>
                    {' on your last '}
                    {conceptData.attempts} answer{conceptData.attempts !== 1 ? 's' : ''}
                    {' over the past 90 days'}
                  </>
                )}
                {conceptData && conceptData.accuracy === null && conceptData.attempts === 0 && (
                  <> · No attempts yet</>
                )}
              </p>
            </div>

            {/* Lesson rows */}
            {conceptLessons.length === 0 ? (
              <p className="text-sm text-ink-3 py-4">No lessons for this concept yet.</p>
            ) : (
              <div className="card divide-y divide-line !p-0 overflow-hidden">
                {conceptLessons.map((lesson) => {
                  const titleDisplay = lesson.title.startsWith(prefix)
                    ? lesson.title.slice(prefix.length)
                    : lesson.title
                  return (
                    <LessonRow
                      key={lesson.lesson_id ?? lesson.title}
                      lesson={lesson}
                      progress={lesson.lesson_id ? progressMap[lesson.lesson_id] : undefined}
                      titleOverride={titleDisplay}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Search results ──────────────────────────────────────────────────────────
  const searchActive = search.trim().length > 0
  const searchResults = searchActive
    ? lessons.filter((l) => l.title.toLowerCase().includes(search.toLowerCase()))
    : []

  // ── Main view (principles + concept chips) ──────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Lessons</h1>
        <p className="text-sm text-ink-2 mt-1">
          Five Controlled Chaos principles. Everything is unlocked - train in any order.
        </p>
      </div>

      {/* Search (4.2) */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search lessons..."
          className="input pl-12"
        />
      </div>

      {loading && <p className="text-sm text-ink-3">Loading...</p>}

      {/* Search results (4.5) */}
      {searchActive && !loading && (
        <>
          {searchResults.length === 0 ? (
            <p className="text-sm text-ink-3 py-4 text-center">No lessons match your search.</p>
          ) : (
            <div className="card divide-y divide-line !p-0 overflow-hidden">
              {searchResults.map((lesson) => (
                <LessonRow
                  key={lesson.lesson_id ?? lesson.title}
                  lesson={lesson}
                  progress={lesson.lesson_id ? progressMap[lesson.lesson_id] : undefined}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Principles (4.6 always expanded) */}
      {!searchActive && skillsPath && (
        <div className="space-y-4">
          {skillsPath.map((p, i) => {
            const practiced = p.concepts.filter((c) => c.attempts > 0).length
            const avg = principleAvg(p)
            const barColor = avg >= 75
              ? 'bg-success'
              : avg >= 50
              ? 'bg-warning'
              : avg > 0
              ? 'bg-error'
              : ''
            return (
              <div key={p.slug} className="card space-y-4">
                {/* Principle header */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-gold font-bold text-sm">{i + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-semibold text-ink leading-tight">{p.name}</h2>
                    <p className="text-xs text-ink-3 mt-0.5">
                      {practiced} of {p.concepts.length} concept{p.concepts.length !== 1 ? 's' : ''} practiced
                      {avg > 0 && <span className="ml-1">· {avg}% avg accuracy</span>}
                    </p>
                    <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'var(--progress-track-bg)' }}>
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${avg}%` }} />
                    </div>
                  </div>
                </div>

                {/* Concept chips (4.4 - tap to open concept page) */}
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {p.concepts.map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => setSearchParams({ concept: c.slug })}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-canvas border border-line hover:border-gold/40 hover:bg-elevated transition-colors group text-left"
                    >
                      <span className="text-sm font-medium text-ink truncate group-hover:text-gold transition-colors">
                        {c.name}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.accuracy !== null ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${accuracyBadge(c.accuracy)}`}>
                            {c.accuracy}%
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-surface text-ink-3">
                            Not started
                          </span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-ink-3 group-hover:text-gold transition-colors" />
                      </div>
                    </button>
                  ))}
                  {p.concepts.length === 0 && (
                    <p className="text-sm text-ink-3">No concepts yet.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
