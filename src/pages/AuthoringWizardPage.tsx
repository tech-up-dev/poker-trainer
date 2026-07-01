import { useState } from 'react'
import type { JSX, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { LessonSchema } from '../../shared/schemas/lesson'
import type { HandScenarioState } from '../../shared/schemas/lesson'
import { supabaseProd } from '../lib/supabase-prod'
import { TableBuilder } from '../components/TableBuilder'
import { linkifyGlossaryTerms } from '../lib/glossary-text'

// ── Types ─────────────────────────────────────────────────────────────────────

type WizardStep = 'lesson' | 'type' | 'table' | 'qa' | 'vocab' | 'review'

type DraftAnswer = { text: string; is_correct: boolean; explanation: string }

type DraftQuestion = {
  _id: string
  type: 'multiple_choice' | 'hand_scenario'
  table_state?: HandScenarioState
  prompt: string
  answers: [DraftAnswer, DraftAnswer, DraftAnswer, DraftAnswer]
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'done'; contentId: string }
  | { kind: 'error'; message: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_LABELS: Record<WizardStep, string> = {
  lesson: 'Lesson',
  type: 'Type',
  table: 'Table',
  qa: 'Q&A',
  vocab: 'Vocab',
  review: 'Review',
}

const ALL_STEPS: WizardStep[] = ['lesson', 'type', 'table', 'qa', 'vocab', 'review']

const INITIAL_TABLE: HandScenarioState = {
  street: 'preflop',
  hero_position: 'BTN',
  pot_size: 0,
  hero_hole_cards: [],
  board_cards: [],
  stack_sizes: { BTN: 500 },
  villain_player_types: {},
}

const LETTERS = ['A', 'B', 'C', 'D']

// ── Helpers ───────────────────────────────────────────────────────────────────

function blankAnswer(correct = false): DraftAnswer {
  return { text: '', is_correct: correct, explanation: '' }
}

function blankQuestion(type: 'multiple_choice' | 'hand_scenario', n: number): DraftQuestion {
  return {
    _id: `q-${Date.now()}-${n}`,
    type,
    table_state: type === 'hand_scenario' ? { ...INITIAL_TABLE } : undefined,
    prompt: '',
    answers: [blankAnswer(true), blankAnswer(), blankAnswer(), blankAnswer()],
  }
}

function prevStep(step: WizardStep, qType: 'multiple_choice' | 'hand_scenario'): WizardStep {
  if (step === 'type') return 'lesson'
  if (step === 'table') return 'type'
  if (step === 'qa') return qType === 'hand_scenario' ? 'table' : 'type'
  if (step === 'vocab') return 'qa'
  if (step === 'review') return 'vocab'
  return 'lesson'
}

function assembleLesson(
  title: string,
  principleTag: string,
  concept: string,
  difficulty: string,
  questionType: 'multiple_choice' | 'hand_scenario',
  completedQuestions: DraftQuestion[],
  currentQuestion: DraftQuestion,
  vocabTerms: string[],
): unknown {
  const allQuestions = [...completedQuestions, currentQuestion]
  return {
    title: title.trim(),
    principle_tag: principleTag.trim(),
    concept: concept.trim(),
    ...(difficulty ? { difficulty } : {}),
    questions: allQuestions.map((q, i) => ({
      question_id: `q-${i + 1}`,
      type: questionType,
      prompt: q.prompt.trim(),
      answers: q.answers.map((a) => ({
        text: a.text.trim(),
        is_correct: a.is_correct,
        explanation: a.explanation.trim(),
      })),
      ...(questionType === 'hand_scenario' && q.table_state ? { table_state: q.table_state } : {}),
      ...(vocabTerms.length > 0 ? { glossary_terms: vocabTerms } : {}),
    })),
  }
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }): JSX.Element {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9DB2C9]">{label}</p>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

function AdminInput({
  value,
  onChange,
  placeholder,
  hasError,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hasError?: boolean
}): JSX.Element {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[#0E2A47] border rounded px-3 py-2 text-sm text-[#EAF1F8] placeholder-[#4a6280] outline-none focus:border-[#5DA2E0] transition-colors ${hasError ? 'border-red-500' : 'border-[#2a5079]'}`}
    />
  )
}

function AdminTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  hasError,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  hasError?: boolean
}): JSX.Element {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-[#0E2A47] border rounded px-3 py-2 text-sm text-[#EAF1F8] placeholder-[#4a6280] outline-none focus:border-[#5DA2E0] resize-none transition-colors ${hasError ? 'border-red-500' : 'border-[#2a5079]'}`}
    />
  )
}

function StepIndicator({
  current,
  questionType,
}: {
  current: WizardStep
  questionType: 'multiple_choice' | 'hand_scenario'
}): JSX.Element {
  const currentIdx = ALL_STEPS.indexOf(current)
  return (
    <div className="flex items-center gap-0">
      {ALL_STEPS.map((step, i) => {
        const isActive = step === current
        const isDone = i < currentIdx
        const isSkipped = step === 'table' && questionType === 'multiple_choice'
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  isSkipped
                    ? 'bg-[#0E2A47] text-[#2a5079] border border-[#2a5079]'
                    : isActive
                      ? 'bg-[#F4A024] text-[#07182C]'
                      : isDone
                        ? 'bg-[#3dbe8a] text-[#07182C]'
                        : 'bg-[#0E2A47] text-[#6B83A0] border border-[#2a5079]'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isSkipped ? 'text-[#2a5079]' : isActive ? 'text-[#F4A024]' : isDone ? 'text-[#3dbe8a]' : 'text-[#6B83A0]'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </div>
            {i < ALL_STEPS.length - 1 && (
              <div className={`w-8 h-px mb-5 mx-1 ${i < currentIdx ? 'bg-[#3dbe8a]' : 'bg-[#2a5079]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Lesson metadata ───────────────────────────────────────────────────

function StepLesson({
  title, principleTag, concept, difficulty,
  onTitle, onPrincipleTag, onConcept, onDifficulty,
  errors,
}: {
  title: string; principleTag: string; concept: string; difficulty: string
  onTitle: (v: string) => void; onPrincipleTag: (v: string) => void
  onConcept: (v: string) => void; onDifficulty: (v: string) => void
  errors: Record<string, string>
}): JSX.Element {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#EAF1F8]">Lesson details</h2>
        <p className="text-sm text-[#9DB2C9] mt-1">Fill in the lesson metadata. Title, tag and concept are required.</p>
      </div>

      <Field label="Title *" error={errors.title}>
        <AdminInput value={title} onChange={onTitle} placeholder="e.g. Pre-flop Opens from UTG" hasError={!!errors.title} />
      </Field>

      <Field label="Principle tag *" error={errors.principle_tag}>
        <AdminInput value={principleTag} onChange={onPrincipleTag} placeholder="e.g. opening_ranges_utg" hasError={!!errors.principle_tag} />
      </Field>

      <Field label="Concept / intro *" error={errors.concept}>
        <AdminTextarea value={concept} onChange={onConcept} placeholder="One-sentence description shown on the lesson card and intro screen." rows={2} hasError={!!errors.concept} />
      </Field>

      <Field label="Difficulty">
        <select
          value={difficulty}
          onChange={(e) => onDifficulty(e.target.value)}
          className="w-full bg-[#0E2A47] border border-[#2a5079] rounded px-3 py-2 text-sm text-[#EAF1F8] outline-none focus:border-[#5DA2E0]"
        >
          <option value="">- optional -</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </Field>
    </div>
  )
}

// ── Step 2: Question type ─────────────────────────────────────────────────────

function StepType({
  questionType, onQuestionType,
}: {
  questionType: 'multiple_choice' | 'hand_scenario'
  onQuestionType: (v: 'multiple_choice' | 'hand_scenario') => void
}): JSX.Element {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#EAF1F8]">Question type</h2>
        <p className="text-sm text-[#9DB2C9] mt-1">Applies to all questions in this lesson. Hand scenarios include the visual poker table.</p>
      </div>

      <div className="space-y-3">
        {(
          [
            {
              value: 'multiple_choice' as const,
              label: 'General Q&A',
              desc: 'Text-only question with 4 answer choices. No table required.',
            },
            {
              value: 'hand_scenario' as const,
              label: 'Hand Scenario',
              desc: 'Question includes a visual poker table: street, positions, cards, pot.',
            },
          ] as const
        ).map(({ value, label, desc }) => (
          <button
            key={value}
            type="button"
            onClick={() => onQuestionType(value)}
            className={`w-full text-left p-4 rounded-xl border transition-colors ${
              questionType === value
                ? 'border-[#F4A024] bg-[#F4A024]/10'
                : 'border-[#2a5079] bg-[#0E2A47] hover:border-[#5DA2E0]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  questionType === value ? 'border-[#F4A024] bg-[#F4A024]' : 'border-[#6B83A0]'
                }`}
              />
              <div>
                <p className="text-sm font-semibold text-[#EAF1F8]">{label}</p>
                <p className="text-xs text-[#9DB2C9] mt-0.5">{desc}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Step 3: Table builder (hand_scenario only) ────────────────────────────────

function StepTable({
  tableState,
  onTableState,
  questionNumber,
}: {
  tableState: HandScenarioState
  onTableState: (s: HandScenarioState) => void
  questionNumber: number
}): JSX.Element {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#F4A024]">
          Question {questionNumber}
        </p>
        <h2 className="text-lg font-bold text-[#EAF1F8] mt-0.5">Configure the table</h2>
        <p className="text-sm text-[#9DB2C9] mt-1">
          Set up the hand scenario: street, positions, hole cards, board, villains.
        </p>
      </div>
      <TableBuilder value={tableState} onChange={onTableState} />
    </div>
  )
}

// ── Step 4: Q&A form ──────────────────────────────────────────────────────────

function StepQA({
  question,
  onQuestion,
  completedQuestions,
  onEditCompleted,
  onDeleteCompleted,
  errors,
  questionNumber,
}: {
  question: DraftQuestion
  onQuestion: (q: DraftQuestion) => void
  completedQuestions: DraftQuestion[]
  onEditCompleted: (idx: number) => void
  onDeleteCompleted: (idx: number) => void
  errors: Record<string, string>
  questionNumber: number
}): JSX.Element {
  function setPrompt(v: string): void {
    onQuestion({ ...question, prompt: v })
  }

  function setAnswerField(i: number, field: keyof DraftAnswer, value: string | boolean): void {
    const next = question.answers.map((a, idx) => {
      if (field === 'is_correct') {
        return { ...a, is_correct: idx === i }
      }
      return idx === i ? { ...a, [field]: value } : a
    }) as [DraftAnswer, DraftAnswer, DraftAnswer, DraftAnswer]
    onQuestion({ ...question, answers: next })
  }

  const correctIdx = question.answers.findIndex((a) => a.is_correct)

  return (
    <div className="space-y-6">
      {completedQuestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9DB2C9]">
            Questions added ({completedQuestions.length})
          </p>
          {completedQuestions.map((q, i) => (
            <div key={q._id} className="flex items-start justify-between gap-3 bg-[#0E2A47] border border-[#2a5079] rounded-lg px-3 py-2">
              <p className="text-xs text-[#9DB2C9] line-clamp-2 flex-1">
                <span className="text-[#F4A024] font-semibold mr-1">Q{i + 1}.</span>
                {q.prompt || <em className="text-[#6B83A0]">No prompt</em>}
              </p>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => onEditCompleted(i)} className="text-[11px] text-[#5DA2E0] hover:underline">Edit</button>
                <button type="button" onClick={() => onDeleteCompleted(i)} className="text-[11px] text-red-400 hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#F4A024]">
            Question {questionNumber}
          </p>
          <h2 className="text-lg font-bold text-[#EAF1F8] mt-0.5">Write the Q&A</h2>
        </div>

        <Field label="Question prompt *" error={errors.prompt}>
          <AdminTextarea
            value={question.prompt}
            onChange={setPrompt}
            placeholder="What should the hero do here?"
            rows={3}
            hasError={!!errors.prompt}
          />
        </Field>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9DB2C9]">
            Answers - mark exactly one correct
          </p>
          {errors.answers && <p className="text-xs text-red-400">{errors.answers}</p>}
          {question.answers.map((answer, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 space-y-2 transition-colors ${
                answer.is_correct ? 'border-[#3dbe8a] bg-[#3dbe8a]/8' : 'border-[#2a5079] bg-[#0E2A47]'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAnswerField(i, 'is_correct', true)}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-[10px] font-bold transition-colors ${
                    answer.is_correct
                      ? 'border-[#3dbe8a] bg-[#3dbe8a] text-[#07182C]'
                      : 'border-[#6B83A0] hover:border-[#3dbe8a]'
                  }`}
                >
                  {answer.is_correct ? '✓' : ''}
                </button>
                <span className="text-[11px] font-bold text-[#9DB2C9]">{LETTERS[i]}</span>
                <input
                  type="text"
                  value={answer.text}
                  onChange={(e) => setAnswerField(i, 'text', e.target.value)}
                  placeholder={`Answer ${LETTERS[i]}`}
                  className={`flex-1 bg-transparent border-b text-sm text-[#EAF1F8] placeholder-[#4a6280] outline-none pb-0.5 transition-colors ${
                    errors[`answer_${i}_text`] ? 'border-red-500' : 'border-[#2a5079] focus:border-[#5DA2E0]'
                  }`}
                />
              </div>
              <div>
                {errors[`answer_${i}_explanation`] && (
                  <p className="text-xs text-red-400 mb-1">{errors[`answer_${i}_explanation`]}</p>
                )}
                <AdminTextarea
                  value={answer.explanation}
                  onChange={(v) => setAnswerField(i, 'explanation', v)}
                  placeholder="Explain why this answer is right or wrong…"
                  rows={2}
                  hasError={!!errors[`answer_${i}_explanation`]}
                />
              </div>
            </div>
          ))}
          {correctIdx === -1 && (
            <p className="text-xs text-red-400">Mark one answer as correct by clicking the circle.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step 5: Vocab / glossary terms ────────────────────────────────────────────

function StepVocab({
  vocabInput,
  onVocabInput,
  previewQuestion,
}: {
  vocabInput: string
  onVocabInput: (v: string) => void
  previewQuestion: DraftQuestion | null
}): JSX.Element {
  const terms = vocabInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#EAF1F8]">Vocabulary terms</h2>
        <p className="text-sm text-[#9DB2C9] mt-1">
          Enter glossary terms that appear in your questions. Members tap them to open the definition. Optional.
        </p>
      </div>

      <Field label="Terms (comma-separated)">
        <AdminInput
          value={vocabInput}
          onChange={onVocabInput}
          placeholder="e.g. c-bet, 3-bet, fold equity"
        />
      </Field>

      {terms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {terms.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded-full border border-[#2a5079] bg-[#0E2A47] text-[#9DB2C9]">
              {t}
            </span>
          ))}
        </div>
      )}

      {previewQuestion && previewQuestion.prompt && terms.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9DB2C9]">
            Live preview - Q1 prompt
          </p>
          <div className="bg-[#0E2A47] border border-[#2a5079] rounded-xl px-4 py-3 text-sm text-[#EAF1F8] leading-relaxed">
            {linkifyGlossaryTerms(previewQuestion.prompt, terms)}
          </div>
          <p className="text-[11px] text-[#6B83A0]">Underlined terms open the glossary drawer in the member app.</p>
        </div>
      )}

      {(!previewQuestion?.prompt || terms.length === 0) && (
        <p className="text-sm text-[#6B83A0]">
          {terms.length === 0
            ? 'No terms entered yet - you can skip this step.'
            : 'No prompt on Q1 to preview yet.'}
        </p>
      )}
    </div>
  )
}

// ── Step 6: Review + Save ─────────────────────────────────────────────────────

function StepReview({
  lesson,
  saveState,
  onSave,
  validationErrors,
}: {
  lesson: unknown
  saveState: SaveState
  onSave: () => void
  validationErrors: string[]
}): JSX.Element {
  const obj = lesson as Record<string, unknown>
  const questions = (obj.questions as unknown[]) ?? []

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-[#EAF1F8]">Review & save</h2>
        <p className="text-sm text-[#9DB2C9] mt-1">
          Check the summary below, then save to staging. You can promote to production from the staging browser.
        </p>
      </div>

      <div className="bg-[#0E2A47] border border-[#2a5079] rounded-xl p-4 space-y-3 text-sm">
        <div className="grid grid-cols-[120px_1fr] gap-y-2 text-[#9DB2C9]">
          <span className="font-semibold text-[#EAF1F8]">Title</span>
          <span>{String(obj.title ?? '')}</span>
          <span className="font-semibold text-[#EAF1F8]">Tag</span>
          <span>{String(obj.principle_tag ?? '')}</span>
          <span className="font-semibold text-[#EAF1F8]">Concept</span>
          <span className="line-clamp-2">{String(obj.concept ?? '')}</span>
          {obj.difficulty && (
            <>
              <span className="font-semibold text-[#EAF1F8]">Difficulty</span>
              <span>{String(obj.difficulty)}</span>
            </>
          )}
          <span className="font-semibold text-[#EAF1F8]">Questions</span>
          <span>{questions.length}</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9DB2C9]">Questions</p>
        {questions.map((q, i) => {
          const qObj = q as Record<string, unknown>
          const answers = (qObj.answers as unknown[]) ?? []
          const correctAnswer = answers.find((a) => (a as Record<string, unknown>).is_correct)
          return (
            <div key={i} className="bg-[#0E2A47] border border-[#2a5079] rounded-lg px-3 py-2 space-y-1">
              <p className="text-xs font-semibold text-[#F4A024]">Q{i + 1} · {String(qObj.type ?? '')}</p>
              <p className="text-sm text-[#EAF1F8] line-clamp-2">{String(qObj.prompt ?? '')}</p>
              {correctAnswer && (
                <p className="text-xs text-[#3dbe8a]">
                  ✓ {String((correctAnswer as Record<string, unknown>).text ?? '')}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-red-600 bg-red-600/10 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-red-300">Validation errors - fix before saving:</p>
          {validationErrors.map((e, i) => (
            <p key={i} className="text-xs text-red-400">{e}</p>
          ))}
        </div>
      )}

      {saveState.kind === 'done' && (
        <div className="rounded-xl border border-[#3dbe8a] bg-[#3dbe8a]/10 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-[#3dbe8a]">Saved to staging</p>
          <p className="text-xs text-[#9DB2C9] font-mono">{saveState.contentId}</p>
          <p className="text-xs text-[#9DB2C9]">
            Go to Admin → Staging Browser to review and promote to production.
          </p>
        </div>
      )}

      {saveState.kind === 'error' && (
        <div className="rounded-xl border border-red-600 bg-red-600/10 px-4 py-3">
          <p className="text-sm text-red-300">{saveState.message}</p>
        </div>
      )}

      {saveState.kind !== 'done' && (
        <button
          type="button"
          onClick={onSave}
          disabled={saveState.kind === 'saving' || validationErrors.length > 0}
          className="w-full min-h-11 rounded-xl text-sm font-semibold bg-[#F4A024] text-[#07182C] hover:bg-[#E0901A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saveState.kind === 'saving' ? 'Saving…' : 'Save to staging'}
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AuthoringWizardPage(): JSX.Element {
  const navigate = useNavigate()

  // Step 1 state
  const [title, setTitle] = useState('')
  const [principleTag, setPrincipleTag] = useState('')
  const [concept, setConcept] = useState('')
  const [difficulty, setDifficulty] = useState('')

  // Step 2 state
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'hand_scenario'>('multiple_choice')

  // Steps 3-4 state
  const [completedQuestions, setCompletedQuestions] = useState<DraftQuestion[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<DraftQuestion>(() => blankQuestion('multiple_choice', 0))

  // Step 5 state
  const [vocabInput, setVocabInput] = useState('')

  // Navigation
  const [step, setStep] = useState<WizardStep>('lesson')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })

  const vocabTerms = vocabInput.split(',').map((t) => t.trim()).filter(Boolean)

  const assembled = assembleLesson(
    title, principleTag, concept, difficulty,
    questionType, completedQuestions, currentQuestion, vocabTerms,
  )

  // When question type changes, reset question drafts
  function handleSetQuestionType(t: 'multiple_choice' | 'hand_scenario'): void {
    setQuestionType(t)
    setCompletedQuestions([])
    setCurrentQuestion(blankQuestion(t, 0))
  }

  // Validate step 1
  function validateLesson(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Title is required'
    if (!principleTag.trim()) e.principle_tag = 'Principle tag is required'
    if (!concept.trim()) e.concept = 'Concept is required'
    return e
  }

  // Validate current question (step 4)
  function validateQuestion(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!currentQuestion.prompt.trim()) e.prompt = 'Question prompt is required'
    currentQuestion.answers.forEach((a, i) => {
      if (!a.text.trim()) e[`answer_${i}_text`] = `Answer ${LETTERS[i]} text is required`
      if (!a.explanation.trim()) e[`answer_${i}_explanation`] = `Answer ${LETTERS[i]} explanation is required`
    })
    const correctCount = currentQuestion.answers.filter((a) => a.is_correct).length
    if (correctCount !== 1) e.answers = 'Exactly one answer must be marked correct'
    return e
  }

  // Commit current question and start a new one
  function commitAndAddAnother(): boolean {
    const e = validateQuestion()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return false
    }
    setErrors({})
    setCompletedQuestions((prev) => [...prev, currentQuestion])
    setCurrentQuestion(blankQuestion(questionType, completedQuestions.length + 1))
    return true
  }

  function handleAddAnother(): void {
    if (!commitAndAddAnother()) return
    // For hand_scenario go back to table config for the new question
    if (questionType === 'hand_scenario') {
      setStep('table')
    }
    // For multiple_choice stay in qa with fresh form
  }

  function handleEditCompleted(idx: number): void {
    // Push current back to completed at end, pull idx out to edit
    const e = validateQuestion()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return
    }
    setErrors({})
    const allQ = [...completedQuestions, currentQuestion]
    const toEdit = allQ[idx]
    allQ.splice(idx, 1)
    const last = allQ.pop()
    setCompletedQuestions(allQ)
    setCurrentQuestion(last ?? blankQuestion(questionType, allQ.length))
    // If editing, put the selected one as current (simplified: just replace current)
    setCompletedQuestions(allQ)
    setCurrentQuestion(toEdit)
  }

  function handleDeleteCompleted(idx: number): void {
    setCompletedQuestions((prev) => prev.filter((_, i) => i !== idx))
  }

  function handleContinue(): void {
    setErrors({})

    if (step === 'lesson') {
      const e = validateLesson()
      if (Object.keys(e).length > 0) { setErrors(e); return }
      setStep('type')
      return
    }

    if (step === 'type') {
      setStep(questionType === 'hand_scenario' ? 'table' : 'qa')
      return
    }

    if (step === 'table') {
      setStep('qa')
      return
    }

    if (step === 'qa') {
      const e = validateQuestion()
      if (Object.keys(e).length > 0) { setErrors(e); return }
      // Commit the current question before moving to vocab
      setCompletedQuestions((prev) => {
        const next = [...prev, currentQuestion]
        setCurrentQuestion(blankQuestion(questionType, next.length))
        return next
      })
      setStep('vocab')
      return
    }

    if (step === 'vocab') {
      setStep('review')
      return
    }
  }

  function handleBack(): void {
    setErrors({})
    if (step === 'review') { setStep('vocab'); return }
    if (step === 'vocab') {
      // Restore the last completed question back to currentQuestion for editing
      if (completedQuestions.length > 0) {
        const last = completedQuestions[completedQuestions.length - 1]
        setCompletedQuestions((prev) => prev.slice(0, -1))
        setCurrentQuestion(last)
      }
      setStep('qa')
      return
    }
    setStep(prevStep(step, questionType))
  }

  // Zod validation errors for review step
  const zodResult = LessonSchema.safeParse(assembled)
  const validationErrors = zodResult.success
    ? []
    : zodResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)

  async function handleSave(): Promise<void> {
    if (!zodResult.success) return
    setSaveState({ kind: 'saving' })
    const { data, error } = await supabaseProd.functions.invoke('save-to-staging', {
      body: { content_type: 'lesson', content: assembled },
    })
    const result = data as { ok: boolean; content_id?: string; message?: string } | null
    if (error || !result?.ok) {
      setSaveState({ kind: 'error', message: result?.message ?? error?.message ?? 'Unknown error' })
    } else {
      setSaveState({ kind: 'done', contentId: result.content_id ?? '(unknown)' })
    }
  }

  const questionNumber = completedQuestions.length + 1
  const isFirstStep = step === 'lesson'
  const showContinue = step !== 'review'

  return (
    <div className="min-h-screen space-y-8 max-w-2xl" style={{ color: '#EAF1F8' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#F4A024]">
            Admin · Content Studio
          </p>
          <h1 className="text-2xl font-bold mt-1">New Lesson Wizard</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="text-sm text-[#9DB2C9] hover:text-[#EAF1F8] shrink-0 mt-1"
        >
          ← Back to admin
        </button>
      </div>

      {/* Step indicator */}
      <StepIndicator current={step} questionType={questionType} />

      {/* Step content */}
      <div className="bg-[#0E2A47] border border-[#2a5079] rounded-2xl p-6">
        {step === 'lesson' && (
          <StepLesson
            title={title} principleTag={principleTag} concept={concept} difficulty={difficulty}
            onTitle={setTitle} onPrincipleTag={setPrincipleTag} onConcept={setConcept} onDifficulty={setDifficulty}
            errors={errors}
          />
        )}
        {step === 'type' && (
          <StepType questionType={questionType} onQuestionType={handleSetQuestionType} />
        )}
        {step === 'table' && (
          <StepTable
            tableState={currentQuestion.table_state ?? { ...INITIAL_TABLE }}
            onTableState={(s) => setCurrentQuestion({ ...currentQuestion, table_state: s })}
            questionNumber={questionNumber}
          />
        )}
        {step === 'qa' && (
          <StepQA
            question={currentQuestion}
            onQuestion={setCurrentQuestion}
            completedQuestions={completedQuestions}
            onEditCompleted={handleEditCompleted}
            onDeleteCompleted={handleDeleteCompleted}
            errors={errors}
            questionNumber={questionNumber}
          />
        )}
        {step === 'vocab' && (
          <StepVocab
            vocabInput={vocabInput}
            onVocabInput={setVocabInput}
            previewQuestion={completedQuestions[0] ?? null}
          />
        )}
        {step === 'review' && (
          <StepReview
            lesson={assembled}
            saveState={saveState}
            onSave={() => void handleSave()}
            validationErrors={validationErrors}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {!isFirstStep && (
          <button
            type="button"
            onClick={handleBack}
            disabled={saveState.kind === 'saving' || saveState.kind === 'done'}
            className="min-h-11 px-6 rounded-xl text-sm font-semibold border border-[#2a5079] text-[#9DB2C9] hover:border-[#5DA2E0] hover:text-[#EAF1F8] disabled:opacity-40 transition-colors"
          >
            ← Back
          </button>
        )}

        {step === 'qa' && (
          <button
            type="button"
            onClick={handleAddAnother}
            className="min-h-11 px-5 rounded-xl text-sm font-semibold border border-[#2a5079] text-[#9DB2C9] hover:border-[#5DA2E0] hover:text-[#EAF1F8] transition-colors"
          >
            + Add another question
          </button>
        )}

        {showContinue && (
          <button
            type="button"
            onClick={handleContinue}
            className="min-h-11 px-6 rounded-xl text-sm font-semibold bg-[#F4A024] text-[#07182C] hover:bg-[#E0901A] transition-colors ml-auto"
          >
            {step === 'qa' ? 'Done with questions →' : step === 'vocab' ? 'Review →' : 'Continue →'}
          </button>
        )}
      </div>
    </div>
  )
}
