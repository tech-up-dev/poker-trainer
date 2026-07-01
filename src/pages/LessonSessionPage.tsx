import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { JSX } from 'react'

import type { Lesson, Question } from '../../shared/schemas/lesson'
import { QuestionCard } from '../components/QuestionCard'
import { fetchPublishedLesson } from '../lib/lessons'
import { upsertProgress } from '../lib/progress'

type SessionPhase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'intro' }
  | { kind: 'quiz'; questionIndex: number; feedbackViewed: boolean }
  | { kind: 'complete'; correct: number; total: number }

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

export function LessonSessionPage(): JSX.Element {
  const { lessonId } = useParams<{ lessonId: string }>()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [phase, setPhase] = useState<SessionPhase>(() =>
    lessonId ? { kind: 'loading' } : { kind: 'error', message: 'No lesson ID provided.' },
  )
  const [randomise, setRandomise] = useState(false)
  // correctness tracked per question index in the ordered list
  const [correctMap, setCorrectMap] = useState<Record<number, boolean>>({})

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

  // Build the ordered question list once, re-shuffle only when randomise toggles
  // before the quiz starts (intro phase). Once the quiz starts the order is fixed.
  const orderedQuestions = useMemo<Question[]>(() => {
    if (!lesson) return []
    return randomise ? shuffled(lesson.questions) : [...lesson.questions]
  }, [lesson, randomise])

  function startQuiz(): void {
    setCorrectMap({})
    setPhase({ kind: 'quiz', questionIndex: 0, feedbackViewed: false })
  }

  function handleFeedbackViewed(questionIndex: number, isCorrect: boolean): void {
    setCorrectMap((prev) => ({ ...prev, [questionIndex]: isCorrect }))
    setPhase((prev) =>
      prev.kind === 'quiz' ? { ...prev, feedbackViewed: true } : prev,
    )
  }

  function handleNext(): void {
    if (phase.kind !== 'quiz') return
    const nextIndex = phase.questionIndex + 1
    if (nextIndex >= orderedQuestions.length) {
      const correct = Object.values({ ...correctMap }).filter(Boolean).length
      const total = orderedQuestions.length
      void upsertProgress({
        lessonId: lessonId ?? '',
        questionsAnswered: total,
        questionsCorrect: correct,
        completed: true,
      }).catch(() => {
        // Progress save is best-effort; don't block the completion screen.
      })
      setPhase({ kind: 'complete', correct, total })
    } else {
      setPhase({ kind: 'quiz', questionIndex: nextIndex, feedbackViewed: false })
    }
  }

  if (phase.kind === 'loading') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-ink-2 text-sm">Loading lesson…</p>
      </div>
    )
  }

  if (phase.kind === 'error') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
        <p className="text-error text-sm text-center">{phase.message}</p>
      </div>
    )
  }

  if (!lesson) return <></>

  // ── Intro screen ──────────────────────────────────────────────────────────
  if (phase.kind === 'intro') {
    return (
      <div className="min-h-screen bg-canvas text-ink px-4 py-10">
        <div className="max-w-md mx-auto space-y-6">
          <button
            type="button"
            onClick={() => navigate('/play')}
            className="text-sm text-link hover:underline"
          >
            ← Back to lessons
          </button>

          <div className="space-y-1">
            {lesson.difficulty && (
              <p className="text-xs font-semibold uppercase tracking-widest text-gold">
                {DIFFICULTY_LABEL[lesson.difficulty] ?? lesson.difficulty}
              </p>
            )}
            <h1 className="text-2xl font-bold">{lesson.title}</h1>
            {lesson.concept && (
              <p className="text-base text-ink-2 leading-relaxed">{lesson.concept}</p>
            )}
          </div>

          <div className="bg-surface border border-line rounded-xl p-4 space-y-1">
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

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={randomise}
                onChange={(e) => setRandomise(e.target.checked)}
              />
              <div
                className={`w-10 h-6 rounded-full transition-colors ${randomise ? 'bg-gold' : 'bg-line'}`}
              />
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-surface transition-transform ${randomise ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </div>
            <span className="text-sm text-ink-2">Randomise question order</span>
          </label>

          <button
            type="button"
            onClick={startQuiz}
            className="min-h-11 w-full rounded-lg text-sm font-semibold bg-gold text-on-gold hover:bg-amber transition-colors"
          >
            Start lesson
          </button>
        </div>
      </div>
    )
  }

  // ── Quiz screen ───────────────────────────────────────────────────────────
  if (phase.kind === 'quiz') {
    const { questionIndex, feedbackViewed } = phase
    const question = orderedQuestions[questionIndex]
    const total = orderedQuestions.length
    const progress = ((questionIndex) / total) * 100

    return (
      <div className="min-h-screen bg-canvas text-ink px-4 py-6">
        <div className="max-w-md mx-auto space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-ink-2">
              <span className="font-medium">{lesson.title}</span>
              <span>
                {questionIndex + 1} / {total}
              </span>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 rounded-full bg-line overflow-hidden">
              <div
                className="h-full rounded-full bg-gold transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <QuestionCard
            key={question.question_id}
            question={question}
            onContinue={(isCorrect) => handleFeedbackViewed(questionIndex, isCorrect)}
          />

          {/* Next / Finish button */}
          <button
            type="button"
            disabled={!feedbackViewed}
            onClick={handleNext}
            className="min-h-11 w-full rounded-lg text-sm font-semibold bg-gold text-on-gold hover:bg-amber disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {questionIndex + 1 < total ? 'Next question' : 'See results'}
          </button>
        </div>
      </div>
    )
  }

  // ── Complete screen ───────────────────────────────────────────────────────
  const { correct, total } = phase
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed = pct >= 70

  return (
    <div className="min-h-screen bg-canvas text-ink px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        <div className="bg-surface border border-line rounded-xl p-6 text-center space-y-4">
          <div
            className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-bold ${passed ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}
          >
            {passed ? '✓' : '✕'}
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold">
              {passed ? 'Lesson complete!' : 'Keep practising'}
            </h2>
            <p className="text-ink-2 text-sm">{lesson.title}</p>
          </div>

          {/* Score */}
          <div className="bg-canvas rounded-xl p-4 space-y-3">
            <div className="text-4xl font-bold text-gold">{pct}%</div>
            <p className="text-sm text-ink-2">
              {correct} correct out of {total} question{total !== 1 ? 's' : ''}
            </p>
            <div className="h-2 rounded-full bg-line overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${passed ? 'bg-success' : 'bg-error'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={startQuiz}
            className="min-h-11 w-full rounded-lg text-sm font-semibold border border-line bg-surface text-ink hover:bg-elevated transition-colors"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => navigate('/play')}
            className="min-h-11 w-full rounded-lg text-sm font-semibold bg-gold text-on-gold hover:bg-amber transition-colors"
          >
            Back to lessons
          </button>
        </div>
      </div>
    </div>
  )
}
