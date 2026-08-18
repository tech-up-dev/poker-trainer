import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import { X, Zap, TrendingUp } from 'lucide-react'

import { QuestionCard } from '../components/QuestionCard'
import { ConfettiCanvas } from '../components/ConfettiCanvas'
import { buildDrill } from '../lib/drill'
import type { DrillQuestion } from '../lib/drill'
import { logAnswerEvent } from '../lib/answer-events'
import { upsertProgress } from '../lib/progress'
import { supabaseProd } from '../lib/supabase-prod'

// Virtual lesson ID used for progress + GHL push — drills count as training sessions.
const DRILL_LESSON_ID = 'drill-session'

type Phase =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'quiz'; questionIndex: number }
  | { kind: 'complete'; correct: number; total: number }

export function DrillSessionPage(): JSX.Element {
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<DrillQuestion[]>([])
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [correctMap, setCorrectMap] = useState<Record<number, boolean>>({})
  const questionStartedAt = useRef<number>(0)

  useEffect(() => {
    buildDrill()
      .then((qs) => {
        if (qs.length === 0) {
          setPhase({ kind: 'empty' })
        } else {
          setQuestions(qs)
          questionStartedAt.current = Date.now()
          setPhase({ kind: 'quiz', questionIndex: 0 })
        }
      })
      .catch(() => setPhase({ kind: 'empty' }))
  }, [])

  function handleContinue(
    questionIndex: number,
    isCorrect: boolean,
    selectedIndex: number,
  ): void {
    const timeTakenMs = Date.now() - questionStartedAt.current
    const q = questions[questionIndex]

    if (q.question_id) {
      void logAnswerEvent({
        lessonId: q.lessonId,
        questionId: q.question_id,
        isCorrect,
        selectedAnswerIndex: selectedIndex,
        timeTakenMs,
        conceptTag: q.conceptSlug,
        street: q.street ?? q.table_state?.street,
        difficulty: q.difficulty,
      }).catch(() => {})
    }

    const nextCorrectMap = { ...correctMap, [questionIndex]: isCorrect }
    setCorrectMap(nextCorrectMap)

    const nextIndex = questionIndex + 1
    if (nextIndex >= questions.length) {
      const correct = Object.values(nextCorrectMap).filter(Boolean).length
      const total = questions.length

      void upsertProgress({
        lessonId: DRILL_LESSON_ID,
        questionsAnswered: total,
        questionsCorrect: correct,
        completed: true,
        contentType: 'drill',
      }).catch(() => {})

      void supabaseProd.functions.invoke('ghl-push-fields')

      setPhase({ kind: 'complete', correct, total })
    } else {
      questionStartedAt.current = Date.now()
      setPhase({ kind: 'quiz', questionIndex: nextIndex })
    }
  }

  if (phase.kind === 'loading') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-ink-3 text-sm">Building your drill…</p>
      </div>
    )
  }

  if (phase.kind === 'empty') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center space-y-5">
          <div className="text-5xl">🎯</div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-ink">No drill available yet</h2>
            <p className="text-sm text-ink-2 leading-relaxed">
              Answer at least 8 questions on a concept before a targeted drill can be built.
              Complete a few lessons first.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void navigate('/play/lessons')}
            className="btn-primary btn-sm"
          >
            Browse lessons
          </button>
        </div>
      </div>
    )
  }

  if (phase.kind === 'complete') {
    const pct = phase.total > 0 ? Math.round((phase.correct / phase.total) * 100) : 0
    return (
      <div className="min-h-screen bg-canvas text-ink flex flex-col items-center justify-center px-4 py-10">
        {pct >= 70 && <ConfettiCanvas />}
        <div className="max-w-sm w-full text-center space-y-6">
          <div className="text-5xl">{pct >= 70 ? '🔥' : '💪'}</div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-ink">Drill complete</h2>
            <p className="text-sm text-ink-2">
              {phase.correct} of {phase.total} correct
            </p>
          </div>
          <div className="card space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-2">Score</span>
              <span className="font-bold text-ink">{pct}%</span>
            </div>
            <div className="progress-bar w-full">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void navigate('/play')}
              className="btn-primary btn-lg w-full"
            >
              <TrendingUp className="w-4 h-4" />
              Back to home
            </button>
            <button
              type="button"
              onClick={() => {
                setCorrectMap({})
                setPhase({ kind: 'loading' })
                buildDrill()
                  .then((qs) => {
                    if (qs.length === 0) {
                      setPhase({ kind: 'empty' })
                    } else {
                      setQuestions(qs)
                      questionStartedAt.current = Date.now()
                      setPhase({ kind: 'quiz', questionIndex: 0 })
                    }
                  })
                  .catch(() => setPhase({ kind: 'empty' }))
              }}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Drill again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Quiz phase
  const { questionIndex } = phase
  const question = questions[questionIndex]
  const total = questions.length

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* Header with progress */}
      <div className="sticky top-0 z-20 bg-canvas/95 backdrop-blur-sm border-b border-line px-4 py-3">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => void navigate('/play')}
            aria-label="Exit drill"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-surface hover:bg-elevated text-ink-2 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex-1 flex gap-1.5">
            {questions.map((_, i) => (
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
          <span className="text-xs text-ink-3 tabular-nums shrink-0">
            {questionIndex + 1}/{total}
          </span>
        </div>
      </div>

      {/* Question label */}
      <div className="px-4 pt-3 pb-0">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 text-xs text-gold font-semibold uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5" />
            Weak spot drill
          </div>
        </div>
      </div>

      {/* Question card */}
      <div className="flex-1 px-4 pt-3 pb-10">
        <div className="max-w-md mx-auto">
          <QuestionCard
            key={`${questionIndex}-${question.question_id}`}
            question={question}
            lessonId={question.lessonId}
            onContinue={(isCorrect, selectedIndex) =>
              handleContinue(questionIndex, isCorrect, selectedIndex)
            }
          />
        </div>
      </div>
    </div>
  )
}
