import { useEffect, useState } from 'react'
import type { JSX } from 'react'

import type { Lesson } from '../../shared/schemas/lesson'
import { GlossaryTerm } from '../components/GlossaryTerm'
import { QuestionCard } from '../components/QuestionCard'
import { ThemeToggle } from '../components/ThemeToggle'
import { fetchPublishedLesson } from '../lib/lessons'

const DEMO_LESSON_ID = 'preflop-opens-utg-9max'

// Temporary harness for verifying member-facing components as they land
// (M1: glossary drawer, MCQ + feedback, poker table). Gets replaced by the
// real member shell/routes once those pieces are built.
export function MemberHomePage(): JSX.Element {
  return (
    <div className="min-h-screen bg-canvas text-ink px-4 py-6">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Beat Small Stakes</h1>
          <ThemeToggle />
        </div>

        <div className="bg-surface border border-line rounded-xl p-4 space-y-3">
          <p className="text-base leading-relaxed">
            Villain is a classic{' '}
            <GlossaryTerm term="Old Man Coffee">Old Man Coffee</GlossaryTerm>{' '}
            who only bets strong hands. Your decision should account for{' '}
            <GlossaryTerm term="Pot Odds">pot odds</GlossaryTerm> before you
            call.
          </p>
          <p className="text-base leading-relaxed">
            A <GlossaryTerm term="Y2K Tag">Y2K Tag</GlossaryTerm> or a{' '}
            <GlossaryTerm term="GTO Boy">GTO Boy</GlossaryTerm> would play
            this very differently.
          </p>
        </div>

        <LessonDemo />
      </div>
    </div>
  )
}

// Steps through a real published lesson's questions one at a time. "Next" is
// only enabled after the current question's feedback has been viewed,
// docs/QA_GUIDE.md "Session-level navigation... enabled only after feedback
// has been viewed."
function LessonDemo(): JSX.Element {
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [feedbackViewed, setFeedbackViewed] = useState(false)

  useEffect(() => {
    fetchPublishedLesson(DEMO_LESSON_ID).then(setLesson, (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to load lesson.')
    })
  }, [])

  if (error) return <p className="text-error text-sm">{error}</p>
  if (!lesson) return <p className="text-ink-2 text-sm">Loading lesson…</p>

  const question = lesson.questions[index]
  const isLast = index === lesson.questions.length - 1

  return (
    <div className="bg-surface border border-line rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink-2">
          {lesson.title} · Question {index + 1} of {lesson.questions.length}
        </h2>
      </div>

      <QuestionCard
        key={question.question_id}
        question={question}
        onContinue={(_isCorrect) => setFeedbackViewed(true)}
      />

      <button
        type="button"
        disabled={!feedbackViewed || isLast}
        onClick={() => {
          setIndex((i) => i + 1)
          setFeedbackViewed(false)
        }}
        className="min-h-11 w-full px-4 rounded-lg text-sm font-semibold bg-gold text-on-gold hover:bg-amber disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isLast ? 'Lesson complete' : 'Next question'}
      </button>
    </div>
  )
}
