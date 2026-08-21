import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { JSX } from 'react'
import { Zap, RotateCcw, Home } from 'lucide-react'

import { buildDrill } from '../lib/drill'
import type { DrillQuestion } from '../lib/drill'
import { upsertProgress } from '../lib/progress'
import { logAnswerEvent } from '../lib/answer-events'
import { QuestionCard } from '../components/QuestionCard'
import { ConfettiCanvas } from '../components/ConfettiCanvas'

const DRILL_LESSON_ID = 'drill-session'

type Phase = 'loading' | 'empty' | 'quiz' | 'complete'

export function DrillSessionPage(): JSX.Element {
  const navigate = useNavigate()
  const [drillKey, setDrillKey] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [questions, setQuestions] = useState<DrillQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    let cancelled = false
    startTimeRef.current = Date.now()

    buildDrill()
      .then((qs) => {
        if (cancelled) return
        if (qs.length === 0) {
          setPhase('empty')
        } else {
          setQuestions(qs)
          setPhase('quiz')
        }
      })
      .catch(() => {
        if (!cancelled) setPhase('empty')
      })

    return () => { cancelled = true }
  }, [drillKey])

  async function handleContinue(isCorrect: boolean, selectedIndex: number): Promise<void> {
    const q = questions[currentIdx]
    if (!q) return

    const timeTakenMs = Date.now() - startTimeRef.current
    startTimeRef.current = Date.now()

    void logAnswerEvent({
      lessonId: DRILL_LESSON_ID,
      questionId: q.question_id,
      isCorrect,
      selectedAnswerIndex: selectedIndex,
      timeTakenMs,
      conceptTag: q.conceptSlug,
    })

    const newCorrect = correctCount + (isCorrect ? 1 : 0)
    const newAnswered = answeredCount + 1

    setCorrectCount(newCorrect)
    setAnsweredCount(newAnswered)

    if (newAnswered >= questions.length) {
      await upsertProgress({
        lessonId: DRILL_LESSON_ID,
        questionsAnswered: newAnswered,
        questionsCorrect: newCorrect,
        completed: true,
        contentType: 'drill',
      }).catch(() => {})
      setPhase('complete')
    } else {
      setCurrentIdx((i) => i + 1)
    }
  }

  function handleDrillAgain(): void {
    setPhase('loading')
    setCurrentIdx(0)
    setCorrectCount(0)
    setAnsweredCount(0)
    setDrillKey((k) => k + 1)
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <p className="text-ink-2">Building your drill…</p>
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4 p-6">
        <Zap className="w-12 h-12 text-gold" />
        <h1 className="text-2xl font-bold text-ink text-center">No drill available</h1>
        <p className="text-ink-2 text-center max-w-sm">
          Answer more questions to unlock concept-targeted drills, or come back after 7 days to
          re-drill recent questions.
        </p>
        <button
          type="button"
          onClick={() => void navigate('/play')}
          className="btn-secondary flex items-center gap-2"
        >
          <Home className="w-4 h-4" />
          Back to dashboard
        </button>
      </div>
    )
  }

  if (phase === 'complete') {
    const pct = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0
    const passed = pct >= 70

    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-6 p-6 relative overflow-hidden">
        {passed && <ConfettiCanvas />}

        <div className="card max-w-sm w-full text-center space-y-4">
          <p className="text-5xl">{passed ? '🎯' : '💪'}</p>
          <h1 className="text-2xl font-bold text-ink">Drill complete!</h1>
          <p className="text-4xl font-bold text-gold">{pct}%</p>
          <p className="text-ink-2">
            {correctCount} of {answeredCount} correct
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={handleDrillAgain}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Drill again
            </button>
            <button
              type="button"
              onClick={() => void navigate('/play')}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const current = questions[currentIdx]

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Progress bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-gold" />
            <span className="text-sm font-semibold text-ink">Drill</span>
          </div>
          <span className="text-sm text-ink-3">
            {currentIdx + 1} / {questions.length}
          </span>
        </div>
        <div className="progress-bar w-full">
          <div
            className="progress-fill"
            style={{ width: `${(currentIdx / questions.length) * 100}%` }}
          />
        </div>

        {current && (
          <QuestionCard
            key={current.question_id}
            question={current}
            lessonId={DRILL_LESSON_ID}
            onContinue={(isCorrect, idx) => void handleContinue(isCorrect, idx)}
          />
        )}
      </div>
    </div>
  )
}
