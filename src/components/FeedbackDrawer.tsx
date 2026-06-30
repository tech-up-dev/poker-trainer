import type { JSX } from 'react'

import type { Question } from '../../shared/schemas/lesson'
import { linkifyGlossaryTerms } from '../lib/glossary-text'

type FeedbackDrawerProps = {
  question: Question
  selectedIndex: number
  onContinue: () => void
  onSaveForLater: () => void
}

// Slide-up drawer shown after a member locks in an MCQ answer. Shows the
// correct/incorrect indicator (icon, not color alone) and explanations for
// every answer so the member learns why each option is right or wrong —
// per docs/QA_GUIDE.md "Multiple-choice question interface".
export function FeedbackDrawer({
  question,
  selectedIndex,
  onContinue,
  onSaveForLater,
}: FeedbackDrawerProps): JSX.Element {
  const selected = question.answers[selectedIndex]
  const isCorrect = selected.is_correct

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Answer feedback"
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 pb-8 shadow-2xl space-y-5"
      >
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-base ${
            isCorrect
              ? 'bg-success/15 text-success'
              : 'bg-error/15 text-error'
          }`}
        >
          <span
            aria-hidden="true"
            className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              isCorrect ? 'bg-success text-on-gold' : 'bg-error text-on-gold'
            }`}
          >
            {isCorrect ? '✓' : '✕'}
          </span>
          {isCorrect ? 'Correct' : 'Incorrect'}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink-2 mb-1">
            Your answer: {selected.text}
          </h3>
          <p className="text-base text-ink leading-relaxed">
            {linkifyGlossaryTerms(selected.explanation, question.glossary_terms)}
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-ink-2">
            Every answer, explained
          </h3>
          {question.answers.map((answer, i) => (
            <div
              key={`${answer.text}-${i}`}
              className="flex gap-3 p-3 rounded-lg bg-canvas border border-line"
            >
              <span
                aria-hidden="true"
                className={`w-6 h-6 mt-0.5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  answer.is_correct
                    ? 'bg-success text-on-gold'
                    : 'bg-error text-on-gold'
                }`}
              >
                {answer.is_correct ? '✓' : '✕'}
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium text-ink">{answer.text}</p>
                <p className="text-sm text-ink-2 leading-relaxed">
                  {linkifyGlossaryTerms(
                    answer.explanation,
                    question.glossary_terms,
                  )}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onSaveForLater}
            className="min-h-11 flex-1 px-4 rounded-lg text-sm font-semibold border border-line text-ink bg-canvas hover:bg-elevated"
          >
            Save for later
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="min-h-11 flex-1 px-4 rounded-lg text-sm font-semibold bg-gold text-on-gold hover:bg-amber"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
