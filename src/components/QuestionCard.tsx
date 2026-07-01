import { useState } from 'react'
import type { JSX } from 'react'

import type { Question } from '../../shared/schemas/lesson'
import { linkifyGlossaryTerms } from '../lib/glossary-text'
import { FeedbackDrawer } from './FeedbackDrawer'
import { PokerTable } from './PokerTable'

const LETTERS = ['A', 'B', 'C', 'D']

type QuestionCardProps = {
  question: Question
  // Fired once the member dismisses the feedback drawer via Continue. Receives
  // whether the selected answer was correct and which index was selected so the
  // session runner can track score and record missed questions for review.
  onContinue: (isCorrect: boolean, selectedIndex: number) => void
}

// Renders an MCQ prompt and exactly four answers; locks the choice on select
// and opens the slide-up feedback drawer. hand_scenario questions render the
// PokerTable above the prompt, driven by question.table_state.
export function QuestionCard({ question, onContinue }: QuestionCardProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  const locked = selectedIndex !== null

  function handleSelect(index: number): void {
    if (locked) return
    setSelectedIndex(index)
    setFeedbackOpen(true)
  }

  function handleContinue(): void {
    const idx = selectedIndex ?? 0
    const isCorrect = question.answers[idx].is_correct
    setFeedbackOpen(false)
    onContinue(isCorrect, idx)
  }

  function handleSaveForLater(): void {
    // Persistence for saved/starred questions isn't built yet (planned for a
    // later milestone); this is a UI affordance only, intentionally a no-op.
  }

  return (
    <div className="space-y-4">
      {question.type === 'hand_scenario' && question.table_state ? (
        <PokerTable tableState={question.table_state} />
      ) : null}

      <p className="text-lg leading-relaxed text-ink">
        {linkifyGlossaryTerms(question.prompt, question.glossary_terms)}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {question.answers.map((answer, i) => {
          const isSelected = selectedIndex === i
          return (
            <button
              key={`${answer.text}-${i}`}
              type="button"
              disabled={locked}
              onClick={() => handleSelect(i)}
              aria-pressed={isSelected}
              className={`min-h-11 px-4 py-3 rounded-lg text-left text-sm font-medium border transition-colors disabled:cursor-not-allowed ${
                isSelected
                  ? 'border-gold bg-elevated text-ink'
                  : 'border-line bg-surface text-ink hover:bg-elevated disabled:hover:bg-surface'
              }`}
            >
              <span className="text-ink-2 font-semibold mr-2">
                {LETTERS[i]}
              </span>
              {answer.text}
            </button>
          )
        })}
      </div>

      {feedbackOpen && selectedIndex !== null ? (
        <FeedbackDrawer
          question={question}
          selectedIndex={selectedIndex}
          onContinue={handleContinue}
          onSaveForLater={handleSaveForLater}
        />
      ) : null}
    </div>
  )
}
