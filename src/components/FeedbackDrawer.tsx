import { useEffect } from 'react'
import type { JSX } from 'react'
import { CheckCircle2, XCircle, ChevronDown } from 'lucide-react'

import type { Question } from '../../shared/schemas/lesson'
import { linkifyGlossaryTerms } from '../lib/glossary-text'

type FeedbackDrawerProps = {
  question: Question
  selectedIndex: number
  isSaved: boolean
  onContinue: () => void
  onSaveForLater: () => void
}

export function FeedbackDrawer({
  question,
  selectedIndex,
  isSaved,
  onContinue,
  onSaveForLater,
}: FeedbackDrawerProps): JSX.Element {
  const selected = question.answers[selectedIndex]
  const isCorrect = selected.is_correct

  // Lock body scroll while open. On iOS Safari, leaving the background
  // scrollable causes the OS to route taps to the scroll system for several
  // seconds, which swallows button taps. position:fixed is required for iOS
  // to actually honour the lock (overflow:hidden alone is ignored there).
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      {/* touch-none prevents touch events bleeding through to the background */}
      <div className="overlay touch-none" onClick={onContinue} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Answer feedback"
        className="fixed inset-x-0 bottom-0 bg-surface-overlay rounded-t-3xl shadow-overlay z-50 animate-slide-up w-full max-w-lg mx-auto max-h-[95vh] overflow-y-auto overscroll-contain p-5 pb-8 space-y-5"
      >
        {/* Result banner */}
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-base ${
            isCorrect ? 'bg-success/15 text-success' : 'bg-error/15 text-error'
          }`}
        >
          {isCorrect
            ? <CheckCircle2 className="w-6 h-6 shrink-0" />
            : <XCircle className="w-6 h-6 shrink-0" />
          }
          {isCorrect ? 'Correct!' : 'Not quite'}
        </div>

        {/* Selected answer explanation */}
        <div>
          <h3 className="text-sm font-semibold text-ink-2 mb-1">
            Your answer: {selected.text}
          </h3>
          <p className="text-base text-ink leading-relaxed">
            {linkifyGlossaryTerms(selected.explanation, question.glossary_terms)}
          </p>
        </div>

        {/* All answers explained - collapsed by default */}
        <details className="group">
          <summary className="flex items-center justify-between cursor-pointer list-none select-none py-1">
            <h3 className="text-sm font-semibold text-ink-2">Every answer, explained</h3>
            <ChevronDown className="w-6 h-6 text-ink-3 transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 space-y-3">
            {question.answers.map((answer, i) => (
              <div
                key={`${answer.text}-${i}`}
                className="flex gap-3 p-3 rounded-xl bg-surface-overlay border border-line"
              >
                <span
                  aria-hidden="true"
                  className={`w-6 h-6 mt-0.5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    answer.is_correct ? 'bg-success text-on-gold' : 'bg-error text-white'
                  }`}
                >
                  {answer.is_correct ? '✓' : '✕'}
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-ink">{answer.text}</p>
                  <p className="text-sm text-ink-2 leading-relaxed">
                    {linkifyGlossaryTerms(answer.explanation, question.glossary_terms)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </details>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onSaveForLater}
            className="btn-secondary btn-sm flex-1 touch-manipulation"
          >
            {isSaved ? 'Saved ✓' : 'Save for later'}
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="btn-primary btn-sm flex-1 touch-manipulation"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}
