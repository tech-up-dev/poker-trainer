import { useState } from 'react'
import type { JSX } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

import type { Question } from '../../shared/schemas/lesson'
import { linkifyGlossaryTerms } from '../lib/glossary-text'
import { saveQuestion, unsaveQuestion } from '../lib/saved-questions'
import { FeedbackDrawer } from './FeedbackDrawer'
import { PokerTable } from './PokerTable'

const LETTERS = ['A', 'B', 'C', 'D']

type QuestionCardProps = {
  question: Question
  lessonId?: string
  onContinue: (isCorrect: boolean, selectedIndex: number) => void
}

export function QuestionCard({ question, lessonId, onContinue }: QuestionCardProps): JSX.Element {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  const locked = selectedIndex !== null

  function handleSelect(index: number): void {
    if (locked) return
    setSelectedIndex(index)
    setTimeout(() => setFeedbackOpen(true), 80)
  }

  function handleContinue(): void {
    const idx = selectedIndex ?? 0
    const isCorrect = question.answers[idx].is_correct
    setFeedbackOpen(false)
    onContinue(isCorrect, idx)
  }

  function handleSaveForLater(): void {
    if (!lessonId || !question.question_id) return
    const next = !isSaved
    setIsSaved(next)
    const op = next
      ? saveQuestion(lessonId, question.question_id)
      : unsaveQuestion(lessonId, question.question_id)
    op.catch(() => {})
  }

  function getButtonClass(index: number): string {
    const answer = question.answers[index]
    const isSelected = selectedIndex === index

    if (!locked) {
      return 'w-full p-3 rounded-xl text-left transition-all border-2 bg-surface-raised border-line hover:border-gold hover:bg-surface-overlay active:scale-[0.98]'
    }

    if (isSelected && answer.is_correct) {
      return 'w-full p-3 rounded-xl text-left transition-all border-2 bg-success/20 border-success'
    }
    if (isSelected && !answer.is_correct) {
      return 'w-full p-3 rounded-xl text-left transition-all border-2 bg-error/20 border-error'
    }
    if (!isSelected && answer.is_correct) {
      return 'w-full p-3 rounded-xl text-left transition-all border-2 bg-success/10 border-success/50'
    }
    return 'w-full p-3 rounded-xl text-left transition-all border-2 bg-surface-raised border-line opacity-60'
  }

  function getLetterBadgeClass(index: number): string {
    const answer = question.answers[index]
    const isSelected = selectedIndex === index

    if (!locked) return 'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 bg-surface text-ink-2'
    if (answer.is_correct) return 'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 bg-success text-white'
    if (isSelected) return 'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 bg-error text-white'
    return 'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 bg-surface text-ink-3'
  }

  return (
    <div className="space-y-3">
      {question.type === 'hand_scenario' && question.table_state ? (
        <PokerTable tableState={question.table_state} size="sm" />
      ) : null}

      <p className="text-base md:text-lg font-semibold text-ink leading-snug">
        {linkifyGlossaryTerms(question.prompt, question.glossary_terms)}
      </p>

      <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Choose your action:</p>

      <div className="grid grid-cols-2 gap-2">
        {question.answers.map((answer, i) => (
          <button
            key={`${answer.text}-${i}`}
            type="button"
            disabled={locked}
            onClick={() => handleSelect(i)}
            aria-pressed={selectedIndex === i}
            className={getButtonClass(i)}
          >
            <div className="flex items-center gap-2">
              <span className={getLetterBadgeClass(i)}>
                {locked && answer.is_correct ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : locked && selectedIndex === i && !answer.is_correct ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  LETTERS[i]
                )}
              </span>
              <p className="text-xs md:text-sm font-medium text-ink leading-tight">{answer.text}</p>
            </div>
          </button>
        ))}
      </div>

      {feedbackOpen && selectedIndex !== null ? (
        <FeedbackDrawer
          question={question}
          selectedIndex={selectedIndex}
          isSaved={isSaved}
          onContinue={handleContinue}
          onSaveForLater={handleSaveForLater}
        />
      ) : null}
    </div>
  )
}
