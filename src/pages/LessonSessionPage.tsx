import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { JSX } from 'react'
import { X, CheckCircle2 } from 'lucide-react'

import type { Lesson, Question } from '../../shared/schemas/lesson'
import { QuestionCard } from '../components/QuestionCard'
import { linkifyGlossaryTerms } from '../lib/glossary-text'
import { fetchPublishedLesson } from '../lib/lessons'
import { upsertProgress } from '../lib/progress'
import { logAnswerEvent } from '../lib/answer-events'

type MissedQuestion = {
  question: Question
  selectedIndex: number
}

type SessionPhase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'intro' }
  | { kind: 'quiz'; questionIndex: number; feedbackViewed: boolean }
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
  const [randomise, setRandomise] = useState(false)
  const [correctMap, setCorrectMap] = useState<Record<number, boolean>>({})
  const [answeredMap, setAnsweredMap] = useState<Record<number, number>>({})
  const questionStartedAt = useRef<number>(Date.now())

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

  const orderedQuestions = useMemo<Question[]>(() => {
    if (!lesson) return []
    return randomise ? shuffled(lesson.questions) : [...lesson.questions]
  }, [lesson, randomise])

  function startQuiz(): void {
    setCorrectMap({})
    setAnsweredMap({})
    questionStartedAt.current = Date.now()
    setPhase({ kind: 'quiz', questionIndex: 0, feedbackViewed: false })
  }

  function handleFeedbackViewed(
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
    setCorrectMap((prev) => ({ ...prev, [questionIndex]: isCorrect }))
    setAnsweredMap((prev) => ({ ...prev, [questionIndex]: selectedIndex }))
    setPhase((prev) =>
      prev.kind === 'quiz' ? { ...prev, feedbackViewed: true } : prev,
    )
  }

  function handleNext(): void {
    if (phase.kind !== 'quiz') return
    const nextIndex = phase.questionIndex + 1

    if (nextIndex >= orderedQuestions.length) {
      const finalCorrectMap = { ...correctMap }
      const finalAnsweredMap = { ...answeredMap }
      const correct = Object.values(finalCorrectMap).filter(Boolean).length
      const total = orderedQuestions.length

      const missed: MissedQuestion[] = orderedQuestions
        .map((q, i) => ({ question: q, selectedIndex: finalAnsweredMap[i] ?? 0, correct: finalCorrectMap[i] }))
        .filter((entry) => entry.correct === false)
        .map(({ question, selectedIndex }) => ({ question, selectedIndex }))

      void upsertProgress({
        lessonId: lessonId ?? '',
        questionsAnswered: total,
        questionsCorrect: correct,
        completed: true,
      }).catch(() => {})

      setPhase({ kind: 'complete', correct, total, missed })
    } else {
      questionStartedAt.current = Date.now()
      setPhase({ kind: 'quiz', questionIndex: nextIndex, feedbackViewed: false })
    }
  }

  if (phase.kind === 'loading') {
    return (
      <div className="min-h-screen bg-[#18181b] flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading lesson…</p>
      </div>
    )
  }

  if (phase.kind === 'error') {
    return (
      <div className="min-h-screen bg-[#18181b] flex items-center justify-center px-4">
        <p className="text-error text-sm text-center">{phase.message}</p>
      </div>
    )
  }

  if (!lesson) return <></>

  // ── Intro screen ──────────────────────────────────────────────────────────
  if (phase.kind === 'intro') {
    return (
      <div className="min-h-screen bg-[#18181b] text-zinc-100 px-4 py-10">
        <div className="max-w-md mx-auto space-y-6">
          <button
            type="button"
            onClick={() => navigate('/play')}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
            Back to lessons
          </button>

          <div className="space-y-2">
            {lesson.difficulty && (
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-brand-500 bg-brand-500/10 px-2.5 py-1 rounded-full">
                {DIFFICULTY_LABEL[lesson.difficulty] ?? lesson.difficulty}
              </span>
            )}
            <h1 className="text-2xl font-bold text-zinc-100">{lesson.title}</h1>
            {lesson.concept && (
              <p className="text-base text-zinc-400 leading-relaxed">{lesson.concept}</p>
            )}
          </div>

          <div className="card space-y-2">
            <p className="text-sm text-zinc-400">
              <span className="font-semibold text-zinc-100">
                {lesson.questions.length} question{lesson.questions.length !== 1 ? 's' : ''}
              </span>{' '}
              · tap each answer, read the feedback, then continue
            </p>
            {lesson.principle_tag && (
              <p className="text-xs text-zinc-500">
                Principle: <span className="text-zinc-400">{lesson.principle_tag}</span>
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
                className={`w-10 h-6 rounded-full transition-colors ${randomise ? 'bg-brand-500' : 'bg-zinc-700'}`}
              />
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${randomise ? 'translate-x-5' : 'translate-x-1'}`}
              />
            </div>
            <span className="text-sm text-zinc-400">Randomise question order</span>
          </label>

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
    const { questionIndex, feedbackViewed } = phase
    const question = orderedQuestions[questionIndex]
    const total = orderedQuestions.length

    return (
      <div className="min-h-screen bg-[#18181b] flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-[#18181b]/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-3">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/play')}
              aria-label="Exit lesson"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex-1 flex gap-1.5">
              {orderedQuestions.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    i < questionIndex
                      ? 'bg-brand-500'
                      : i === questionIndex
                      ? 'bg-brand-500/60'
                      : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-500 shrink-0">
              {questionIndex + 1}/{total}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto px-4 py-5 space-y-5 pb-8">
            <div className="card-elevated space-y-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Scenario</p>
              <QuestionCard
                key={question.question_id}
                question={question}
                lessonId={lessonId}
                onContinue={(isCorrect, selectedIndex) =>
                  handleFeedbackViewed(questionIndex, isCorrect, selectedIndex)
                }
              />
            </div>

            <button
              type="button"
              disabled={!feedbackViewed}
              onClick={handleNext}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {questionIndex + 1 < total ? 'Next question' : 'See results'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Complete screen ───────────────────────────────────────────────────────
  const { correct, total, missed } = phase
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  const passed = pct >= 70

  return (
    <div className="min-h-screen bg-[#18181b] text-zinc-100 px-4 py-10">
      <div className="max-w-md mx-auto space-y-6">
        {/* Score card */}
        <div className="card text-center space-y-5">
          <div
            className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${passed ? 'bg-success/20' : 'bg-error/20'}`}
          >
            {passed
              ? <CheckCircle2 className="w-8 h-8 text-success" />
              : <span className="text-2xl font-bold text-error">✕</span>
            }
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-zinc-100">
              {passed ? 'Lesson complete!' : 'Keep practising'}
            </h2>
            <p className="text-zinc-500 text-sm">{lesson.title}</p>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 space-y-3">
            <div className={`text-4xl font-bold ${passed ? 'text-brand-500' : 'text-error'}`}>{pct}%</div>
            <p className="text-sm text-zinc-400">
              {correct} correct out of {total} question{total !== 1 ? 's' : ''}
            </p>
            <div className="h-2 rounded-full bg-zinc-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${passed ? 'bg-brand-500' : 'bg-error'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Missed questions review */}
        {missed.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest">
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
                  <p className="text-sm font-medium text-zinc-100 leading-relaxed">
                    {linkifyGlossaryTerms(question.prompt, question.glossary_terms)}
                  </p>

                  <div className="flex gap-3 p-3 rounded-xl bg-error/10 border border-error/20">
                    <span className="w-6 h-6 mt-0.5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-error text-white">
                      ✕
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-100">
                        <span className="text-zinc-400 font-semibold mr-1">{LETTERS[selectedIndex]}</span>
                        {wrongAnswer.text}
                      </p>
                      <p className="text-sm text-zinc-400 leading-relaxed">
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
                        <p className="text-sm font-medium text-zinc-100">
                          <span className="text-zinc-400 font-semibold mr-1">{LETTERS[correctIndex]}</span>
                          {correctAnswer.text}
                        </p>
                        <p className="text-sm text-zinc-400 leading-relaxed">
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
