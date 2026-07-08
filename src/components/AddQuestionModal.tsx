import { useState } from 'react'
import type { JSX } from 'react'

import type { HandScenarioState, Question } from '../../shared/schemas/lesson'

// Modal for authoring a single question inside the Table Builder, so a table can
// be bound to a freshly-created question without leaving for the JSON validator.
// When "attach current table" is on the question is created as a hand_scenario
// carrying the built table_state; otherwise it is a plain multiple_choice.
type Props = {
  tableState: HandScenarioState
  busy: boolean
  onClose: () => void
  onCreate: (question: Question) => void
}

type DraftAnswer = { text: string; explanation: string }

const EMPTY_ANSWERS: DraftAnswer[] = [
  { text: '', explanation: '' },
  { text: '', explanation: '' },
  { text: '', explanation: '' },
  { text: '', explanation: '' },
]

export function AddQuestionModal({ tableState, busy, onClose, onCreate }: Props): JSX.Element {
  const [prompt, setPrompt] = useState('')
  const [answers, setAnswers] = useState<DraftAnswer[]>(EMPTY_ANSWERS)
  const [correctIndex, setCorrectIndex] = useState(0)
  const [attachTable, setAttachTable] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function setAnswer(i: number, patch: Partial<DraftAnswer>): void {
    setAnswers((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)))
  }

  function handleSubmit(): void {
    if (!prompt.trim()) return setError('Prompt is required.')
    if (answers.some((a) => !a.text.trim() || !a.explanation.trim())) {
      return setError('Every answer needs text and an explanation.')
    }
    setError(null)
    const question: Question = {
      question_id: `q-${Date.now().toString(36)}`,
      type: attachTable ? 'hand_scenario' : 'multiple_choice',
      prompt: prompt.trim(),
      answers: answers.map((a, i) => ({
        text: a.text.trim(),
        is_correct: i === correctIndex,
        explanation: a.explanation.trim(),
      })),
      ...(attachTable ? { table_state: tableState } : {}),
    }
    onCreate(question)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: 'rgba(3,10,20,0.7)' }}
    >
      <div
        className="w-full max-w-lg my-8 rounded-xl p-5 space-y-4"
        style={{ background: '#0E2A47', border: '1px solid #2a5079', color: '#EAF1F8' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold">Add question</h3>
          <button type="button" onClick={onClose} style={{ color: '#9DB2C9' }} aria-label="Close">
            ✕
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: '#F4A024' }}>
            Prompt
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-[13px]"
            style={{ background: '#07182C', border: '1px solid #2a5079', color: '#EAF1F8' }}
          />
        </label>

        <div className="space-y-3">
          <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: '#F4A024' }}>
            Answers (pick the correct one)
          </span>
          {answers.map((a, i) => (
            <div
              key={i}
              className="rounded-lg p-3 space-y-2"
              style={{ background: '#07182C', border: '1px solid #2a5079' }}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={correctIndex === i}
                  onChange={() => setCorrectIndex(i)}
                />
                <input
                  value={a.text}
                  onChange={(e) => setAnswer(i, { text: e.target.value })}
                  placeholder={`Answer ${i + 1}`}
                  className="flex-1 rounded px-2 py-1 text-[13px]"
                  style={{ background: '#0E2A47', border: '1px solid #2a5079', color: '#EAF1F8' }}
                />
              </div>
              <input
                value={a.explanation}
                onChange={(e) => setAnswer(i, { explanation: e.target.value })}
                placeholder="Explanation"
                className="w-full rounded px-2 py-1 text-[12px]"
                style={{ background: '#0E2A47', border: '1px solid #2a5079', color: '#9DB2C9' }}
              />
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 text-[13px]" style={{ color: '#9DB2C9' }}>
          <input
            type="checkbox"
            checked={attachTable}
            onChange={(e) => setAttachTable(e.target.checked)}
          />
          Attach the current table to this question (hand_scenario)
        </label>

        {error && (
          <p className="text-[12px]" style={{ color: '#F87171' }} role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-[13px] font-semibold"
            style={{ background: '#0E2A47', border: '1px solid #2a5079', color: '#9DB2C9' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold disabled:opacity-40"
            style={{ background: '#F4A024', color: '#07182C' }}
          >
            {busy ? 'Adding…' : 'Add question'}
          </button>
        </div>
      </div>
    </div>
  )
}
