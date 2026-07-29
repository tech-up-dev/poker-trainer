import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { JSX } from 'react'
import { X, CheckCircle2, Sun, Moon, Flame } from 'lucide-react'

import type { Lesson, Question } from '../../shared/schemas/lesson'
import { ConfettiCanvas } from '../components/ConfettiCanvas'
import { QuestionCard } from '../components/QuestionCard'
import { linkifyGlossaryTerms } from '../lib/glossary-text'
import { fetchPublishedLesson } from '../lib/lessons'
import { upsertProgress } from '../lib/progress'
import { logAnswerEvent } from '../lib/answer-events'
import { supabaseProd } from '../lib/supabase-prod'
import { useTheme } from '../lib/theme-context'
import { fetchStreak } from '../lib/streak'

function LessonTopControls(): JSX.Element {
  const { theme, toggleTheme } = useTheme()
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    fetchStreak().then((s) => setStreak(s.current)).catch(() => {})
  }, [])

  return (
    <div className="fixed top-3 right-4 z-30 flex items-center gap-2">
      {streak > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 rounded-full">
          <Flame className="w-4 h-4 text-gold" />
          <span className="text-sm font-semibold text-gold">{streak}</span>
        </div>
      )}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        className="p-2 rounded-lg hover:bg-surface-raised text-ink-2 hover:text-ink transition-colors"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>
    </div>
  )
}

type ResultTier = { min_pct: number; message: string; confetti: boolean }

// Visual styles derived from tier rank (0 = top, last = bottom).
const TIER_STYLES = [
  { color: 'text-gold',    barColor: 'bg-gold',    icon: 'star'  as const },
  { color: 'text-success', barColor: 'bg-success', icon: 'check' as const },
  { color: 'text-warning', barColor: 'bg-warning', icon: 'check' as const },
  { color: 'text-error',   barColor: 'bg-error',   icon: 'x'     as const },
]

const DEFAULT_TIERS: ResultTier[] = [
  { min_pct: 90, message: 'Outstanding performance!',  confetti: true  },
  { min_pct: 70, message: 'Lesson complete!',           confetti: true  },
  { min_pct: 50, message: 'Good effort, keep going!',   confetti: false },
  { min_pct: 0,  message: 'Keep practicing',            confetti: false },
]

async function fetchResultTiers(): Promise<ResultTier[]> {
  const { data, error } = await supabaseProd
    .from('app_settings')
    .select('value')
    .eq('key', 'lesson_result_tiers')
    .single()
  if (error || !data) return DEFAULT_TIERS
  const tiers = data.value as ResultTier[]
  if (!Array.isArray(tiers) || tiers.length === 0) return DEFAULT_TIERS
  return [...tiers].sort((a, b) => b.min_pct - a.min_pct)
}

function resolveTier(pct: number, tiers: ResultTier[]): ResultTier & { color: string; barColor: string; icon: 'star' | 'check' | 'x' } {
  const idx = tiers.findIndex((t) => pct >= t.min_pct)
  const tier = tiers[idx === -1 ? tiers.length - 1 : idx]
  const style = TIER_STYLES[Math.min(idx === -1 ? tiers.length - 1 : idx, TIER_STYLES.length - 1)]
  return { ...tier, ...style }
}

type MissedQuestion = {
  question: Question
  selectedIndex: number
}

type SessionPhase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'intro' }
  | { kind: 'quiz'; questionIndex: number }
  | { kind: 'complete'; correct: number; total: number; missed: MissedQuestion[] }

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const LETTERS = ['A', 'B', 'C', 'D']

export function LessonSessionPage(): JSX.Element {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [phase, setPhase] = useState<SessionPhase>(() =>
    lessonId ? { kind: 'loading' } : { kind: 'error', message: 'No lesson ID provided.' },
  )
  const [correctMap, setCorrectMap] = useState<Record<number, boolean>>({})
  const [answeredMap, setAnsweredMap] = useState<Record<number, number>>({})
  const [displayPct, setDisplayPct] = useState(0)
  const [resultTiers, setResultTiers] = useState<ResultTier[]>(DEFAULT_TIERS)
  const questionStartedAt = useRef<number>(0)

  useEffect(() => {
    void fetchResultTiers().then(setResultTiers)
  }, [])

  useEffect(() => {
    if (!lessonId) return
    fetchPublishedLesson(lessonId).then(
      (data) => {
        if (!data) {
          setPhase({ kind: 'error', message: `Lesson "${lessonId}" not found.` })
        } else {
          setLesson(data)
          setPhase({ kind: 'intro' })
        }
      },
      (err: unknown) => {
        setPhase({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to load lesson.',
        })
      },
    )
  }, [lessonId])

  useEffect(() => {
    if (phase.kind !== 'complete') return
    const target = phase.total > 0 ? Math.round((phase.correct / phase.total) * 100) : 0
    const duration = 800
    const start = performance.now()
    let frame: number
    function tick(now: number): void {
      const t = Math.min(1, (now - start) / duration)
      setDisplayPct(Math.round(t * target))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase])

  const orderedQuestions = useMemo<Question[]>(() => {
    if (!lesson) return []
    return shuffled(lesson.questions)
  }, [lesson])

  function startQuiz(): void {
    setDisplayPct(0)
    setCorrectMap({})
    setAnsweredMap({})
    questionStartedAt.current = Date.now()
    setPhase({ kind: 'quiz', questionIndex: 0 })
  }

  function handleContinue(
    questionIndex: number,
    isCorrect: boolean,
    selectedIndex: number,
  ): void {
    const timeTakenMs = Date.now() - questionStartedAt.current
    const question = orderedQuestions[questionIndex]
    if (question?.question_id) {
      void logAnswerEvent({
        lessonId: lessonId ?? '',
        questionId: question.question_id,
        isCorrect,
        selectedAnswerIndex: selectedIndex,
        timeTakenMs,
      }).catch(() => {})
    }

    // Build updated maps inline so the complete-phase calculation is accurate
    // without waiting for React state to flush.
    const nextCorrectMap = { ...correctMap, [questionIndex]: isCorrect }
    const nextAnsweredMap = { ...answeredMap, [questionIndex]: selectedIndex }
    setCorrectMap(nextCorrectMap)
    setAnsweredMap(nextAnsweredMap)

    const nextIndex = questionIndex + 1
    if (nextIndex >= orderedQuestions.length) {
      const correct = Object.values(nextCorrectMap).filter(Boolean).length
      const total = orderedQuestions.length
      const missed: MissedQuestion[] = orderedQuestions
        .map((q, i) => ({ question: q, selectedIndex: nextAnsweredMap[i] ?? 0, correct: nextCorrectMap[i] }))
        .filter((entry) => entry.correct === false)
        .map(({ question, selectedIndex: si }) => ({ question, selectedIndex: si }))

      void upsertProgress({
        lessonId: lessonId ?? '',
        questionsAnswered: total,
        questionsCorrect: correct,
        completed: true,
      }).catch(() => {})

      setPhase({ kind: 'complete', correct, total, missed })
    } else {
      questionStartedAt.current = Date.now()
      setPhase({ kind: 'quiz', questionIndex: nextIndex })
    }
  }

  if (phase.kind === 'loading') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-ink-3 text-sm">Loading lesson…</p>
      </div>
    )
  }

  if (phase.kind === 'error') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="text-5xl">📭</div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-ink">This lesson isn't available yet</h2>
            <p className="text-sm text-ink-2 leading-relaxed">
              The content for this lesson hasn't been published. Check back soon, it's on its way.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/play')}
            className="btn-primary btn-sm"
          >
            Browse all lessons
          </button>
        </div>
      </div>
    )
  }

  if (!lesson) return <></>

  // ── Intro screen ──────────────────────────────────────────────────────────
  if (phase.kind === 'intro') {
    return (
      <div className="min-h-screen bg-canvas text-ink px-4 py-10">
        <LessonTopControls />
        <div className="max-w-md mx-auto space-y-6">
          <button
            type="button"
            onClick={() => navigate('/play')}
            className="flex items-center gap-2 text-sm text-ink-2 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
            Back to lessons
          </button>

          <div className="space-y-2">
            {lesson.difficulty && (
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-gold bg-gold/10 px-2.5 py-1 rounded-full">
                {DIFFICULTY_LABEL[lesson.difficulty] ?? lesson.difficulty}
              </span>
            )}
            <h1 className="text-2xl font-bold text-ink">{lesson.title}</h1>
            {lesson.concept && (
              <p className="text-base text-ink-2 leading-relaxed">{lesson.concept}</p>
            )}
          </div>

          <div className="card space-y-2">
            <p className="text-sm text-ink-2">
              <span className="font-semibold text-ink">
                {lesson.questions.length} question{lesson.questions.length !== 1 ? 's' : ''}
              </span>{' '}
              · tap each answer, read the feedback, then continue
            </p>
            {lesson.principle_tag && (
              <p className="text-xs text-ink-3">
                Principle: <span className="text-ink-2">{lesson.principle_tag}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={startQuiz}
            className="btn-primary btn-lg w-full"
          >
            Start lesson
          </button>
        </div>
      </div>
    )
  }

  // ── Quiz screen ───────────────────────────────────────────────────────────
  if (phase.kind === 'quiz') {
    const { questionIndex } = phase
    const question = orderedQuestions[questionIndex]
    const total = orderedQuestions.length

    return (
      <div className="min-h-screen bg-canvas flex flex-col">
        <LessonTopControls />
        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-canvas/95 backdrop-blur-sm border-b border-line px-4 py-3">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/play')}
              aria-label="Exit lesson"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-surface hover:bg-elevated text-ink-2 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex-1 flex gap-1.5">
              {orderedQuestions.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i < questionIndex
                      ? 'bg-gold'
                      : i === questionIndex
                      ? 'bg-gold/60'
                      : 'bg-elevated'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-ink-3 shrink-0">
              {questionIndex + 1}/{total}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 py-3 pb-6">
            <div className="card-elevated !p-4 md:!p-6 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">Scenario</p>
              <QuestionCard
                key={question.question_id}
                question={question}
                lessonId={lessonId}
                onContinue={(isCorrect, selectedIndex) =>
                  handleContinue(questionIndex, isCorrect, selectedIndex)
                }
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Complete screen ───────────────────────────────────────────────────────
  const { correct, total, missed } = phase
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0

  const result = resolveTier(pct, resultTiers)
  const barColor = result.barColor

  return (
    <div className="min-h-screen bg-canvas text-ink px-4 py-10">
      <LessonTopControls />
      {result.confetti && (
        <div className="fixed inset-0 pointer-events-none z-10">
          <ConfettiCanvas />
        </div>
      )}
      <div className="max-w-md mx-auto space-y-6">
        {/* Score card */}
        <div className="card text-center space-y-5">
          <div
            className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${result.icon !== 'x' ? 'bg-success/20 animate-pop-bounce' : 'bg-error/20'}`}
          >
            {result.icon !== 'x'
              ? <CheckCircle2 className={`w-8 h-8 ${result.color}`} />
              : <span className="text-2xl font-bold text-error">✕</span>
            }
          </div>
          <div className="space-y-1">
            <h2 className={`text-xl font-bold ${result.color}`}>
              {result.message}
            </h2>
            <p className="text-ink-3 text-sm">{lesson.title}</p>
          </div>
          <div className="bg-canvas rounded-xl p-4 space-y-3 animate-score-reveal">
            <div className={`text-4xl font-bold ${result.color}`}>{displayPct}%</div>
            <p className="text-sm text-ink-2">
              {correct} correct out of {total} question{total !== 1 ? 's' : ''}
            </p>
            <div className="h-2 rounded-full bg-elevated overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${displayPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* CTA buttons - shown above missed questions when there are some to scroll past */}
        {missed.length > 0 && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={startQuiz}
              className="btn-secondary w-full"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => navigate('/play')}
              className="btn-primary w-full"
            >
              Back to lessons
            </button>
          </div>
        )}

        {/* Missed questions review */}
        {missed.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-ink-2 uppercase tracking-widest">
              Review · {missed.length} missed
            </h3>
            {missed.map(({ question, selectedIndex }, i) => {
              const correctAnswer = question.answers.find((a) => a.is_correct)
              const correctIndex = question.answers.findIndex((a) => a.is_correct)
              const wrongAnswer = question.answers[selectedIndex]
              return (
                <div
                  key={`${question.question_id}-${i}`}
                  className="card space-y-4"
                >
                  <p className="text-sm font-medium text-ink leading-relaxed">
                    {linkifyGlossaryTerms(question.prompt, question.glossary_terms)}
                  </p>

                  <div className="flex gap-3 p-3 rounded-xl bg-error/10 border border-error/20">
                    <span className="w-6 h-6 mt-0.5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-error text-white">
                      ✕
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-ink">
                        <span className="text-ink-2 font-semibold mr-1">{LETTERS[selectedIndex]}</span>
                        {wrongAnswer.text}
                      </p>
                      <p className="text-sm text-ink-2 leading-relaxed">
                        {linkifyGlossaryTerms(wrongAnswer.explanation, question.glossary_terms)}
                      </p>
                    </div>
                  </div>

                  {correctAnswer && (
                    <div className="flex gap-3 p-3 rounded-xl bg-success/10 border border-success/20">
                      <span className="w-6 h-6 mt-0.5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-success text-white">
                        ✓
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-ink">
                          <span className="text-ink-2 font-semibold mr-1">{LETTERS[correctIndex]}</span>
                          {correctAnswer.text}
                        </p>
                        <p className="text-sm text-ink-2 leading-relaxed">
                          {linkifyGlossaryTerms(correctAnswer.explanation, question.glossary_terms)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            onClick={startQuiz}
            className="btn-secondary w-full"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => navigate('/play')}
            className="btn-primary w-full"
          >
            Back to lessons
          </button>
        </div>
      </div>
    </div>
  )
}
