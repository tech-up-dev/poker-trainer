import { useState, useEffect, useMemo } from 'react'
import type { JSX, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Tag, LayoutGrid, Table2, HelpCircle, BookText, Download } from 'lucide-react'

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
  review: 'Export',
}

const STEP_ICONS: Record<WizardStep, typeof Tag> = {
  lesson: Tag,
  type:   LayoutGrid,
  table:  Table2,
  qa:     HelpCircle,
  vocab:  BookText,
  review: Download,
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
  if (step === 'vocab') return qType === 'hand_scenario' ? 'table' : 'qa'
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
  // Only include currentQuestion if the user has started filling it in.
  // After "Done with questions" a blank currentQuestion is created as a reset;
  // including it would produce a ghost empty question in the assembled lesson.
  const allQuestions = currentQuestion.prompt.trim()
    ? [...completedQuestions, currentQuestion]
    : [...completedQuestions]
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
      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-2">{label}</p>
      {children}
      {error && <p className="text-xs text-error">{error}</p>}
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
      className={`w-full bg-surface border rounded px-3 py-2 text-sm text-ink placeholder-ink-3 outline-none focus:border-link transition-colors ${hasError ? 'border-error' : 'border-line'}`}
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
      className={`w-full bg-surface border rounded px-3 py-2 text-sm text-ink placeholder-ink-3 outline-none focus:border-link resize-none transition-colors ${hasError ? 'border-error' : 'border-line'}`}
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
    <div className="flex items-center w-full">
      {ALL_STEPS.map((step, i) => {
        const isActive = step === current
        const isDone = i < currentIdx
        const isSkipped =
          (step === 'table' && questionType === 'multiple_choice') ||
          (step === 'qa' && questionType === 'hand_scenario')
        const label =
          step === 'table' && questionType === 'hand_scenario' ? 'Table & Q&A' : STEP_LABELS[step]
        return (
          <div key={step} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  isSkipped
                    ? 'bg-surface text-line border border-line'
                    : isActive
                      ? 'bg-gold text-on-gold'
                      : isDone
                        ? 'bg-success text-on-gold'
                        : 'bg-surface text-ink-3 border border-line'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isSkipped ? 'text-line' : isActive ? 'text-gold' : isDone ? 'text-success' : 'text-ink-3'
                }`}
              >
                {label}
              </span>
            </div>
            {i < ALL_STEPS.length - 1 && (
              <div className={`flex-1 h-px mb-5 mx-1 ${i < currentIdx ? 'bg-success' : 'bg-line'}`} />
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
        <h2 className="text-lg font-bold text-ink">Lesson details</h2>
        <p className="text-sm text-ink-2 mt-1">Fill in the lesson metadata. Title, tag and concept are required.</p>
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
          className="w-full bg-surface border border-line rounded px-3 py-2 text-sm text-ink outline-none focus:border-link"
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
        <h2 className="text-lg font-bold text-ink">Question type</h2>
        <p className="text-sm text-ink-2 mt-1">Applies to all questions in this lesson. Hand scenarios include the visual poker table.</p>
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
                ? 'border-gold bg-gold/10'
                : 'border-line bg-surface hover:border-link'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                  questionType === value ? 'border-gold bg-gold' : 'border-ink-3'
                }`}
              />
              <div>
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="text-xs text-ink-2 mt-0.5">{desc}</p>
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
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
          Question {questionNumber}
        </p>
        <h2 className="text-lg font-bold text-ink mt-0.5">Configure the table</h2>
        <p className="text-sm text-ink-2 mt-1">
          Set up the hand scenario: street, positions, hole cards, board, villains.
        </p>
      </div>
      <TableBuilder value={tableState} onChange={onTableState} />
    </div>
  )
}

// ── Step 3+4 combined: Table + Q&A (hand_scenario only) ──────────────────────

function StepTableAndQA({
  tableState, onTableState,
  question, onQuestion,
  completedQuestions, editingIdx, onEditCompleted, onDeleteCompleted,
  errors, questionNumber,
}: {
  tableState: HandScenarioState
  onTableState: (s: HandScenarioState) => void
  question: DraftQuestion
  onQuestion: (q: DraftQuestion) => void
  completedQuestions: DraftQuestion[]
  editingIdx: number | null
  onEditCompleted: (idx: number) => void
  onDeleteCompleted: (idx: number) => void
  errors: Record<string, string>
  questionNumber: number
}): JSX.Element {
  return (
    <div className="space-y-6">
      <StepTable tableState={tableState} onTableState={onTableState} questionNumber={questionNumber} />
      <div className="border-t border-line" />
      <StepQA
        question={question}
        onQuestion={onQuestion}
        completedQuestions={completedQuestions}
        editingIdx={editingIdx}
        onEditCompleted={onEditCompleted}
        onDeleteCompleted={onDeleteCompleted}
        errors={errors}
        questionNumber={questionNumber}
      />
    </div>
  )
}

// ── Step 4: Q&A form ──────────────────────────────────────────────────────────

function StepQA({
  question,
  onQuestion,
  completedQuestions,
  editingIdx,
  onEditCompleted,
  onDeleteCompleted,
  errors,
  questionNumber,
}: {
  question: DraftQuestion
  onQuestion: (q: DraftQuestion) => void
  completedQuestions: DraftQuestion[]
  editingIdx: number | null
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
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-2">
            Questions added ({completedQuestions.length})
          </p>
          {completedQuestions.map((q, i) => {
            const isEditing = editingIdx === i
            return (
              <div key={q._id} className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 border ${isEditing ? 'border-gold bg-gold/10' : 'bg-surface border-line'}`}>
                <p className="text-xs text-ink-2 line-clamp-2 flex-1">
                  <span className={`font-semibold mr-1 ${isEditing ? 'text-gold' : 'text-gold'}`}>Q{i + 1}.</span>
                  {isEditing
                    ? <em className="text-gold">Editing…</em>
                    : (q.prompt || <em className="text-ink-3">No prompt</em>)
                  }
                </p>
                <div className="flex gap-2 shrink-0">
                  {isEditing
                    ? <span className="text-[11px] text-gold">Editing</span>
                    : <button type="button" onClick={() => onEditCompleted(i)} className="text-[11px] text-link hover:underline">Edit</button>
                  }
                  <button type="button" onClick={() => onDeleteCompleted(i)} className="text-[11px] text-error hover:underline">Remove</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
            Question {questionNumber}
          </p>
          <h2 className="text-lg font-bold text-ink mt-0.5">Write the Q&A</h2>
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
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-2">
            Answers - mark exactly one correct
          </p>
          {errors.answers && <p className="text-xs text-error">{errors.answers}</p>}
          {question.answers.map((answer, i) => (
            <div
              key={i}
              className={`rounded-xl border p-3 space-y-2 transition-colors ${
                answer.is_correct ? 'border-success bg-success/10' : 'border-line bg-surface'
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAnswerField(i, 'is_correct', true)}
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-[10px] font-bold transition-colors ${
                    answer.is_correct
                      ? 'border-success bg-success text-on-gold'
                      : 'border-ink-3 hover:border-success'
                  }`}
                >
                  {answer.is_correct ? '✓' : ''}
                </button>
                <span className="text-[11px] font-bold text-ink-2">{LETTERS[i]}</span>
                <input
                  type="text"
                  value={answer.text}
                  onChange={(e) => setAnswerField(i, 'text', e.target.value)}
                  placeholder={`Answer ${LETTERS[i]}`}
                  className={`flex-1 bg-transparent border-b text-sm text-ink placeholder-ink-3 outline-none pb-0.5 transition-colors ${
                    errors[`answer_${i}_text`] ? 'border-error' : 'border-line focus:border-link'
                  }`}
                />
              </div>
              <div>
                {errors[`answer_${i}_explanation`] && (
                  <p className="text-xs text-error mb-1">{errors[`answer_${i}_explanation`]}</p>
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
            <p className="text-xs text-error">Mark one answer as correct by clicking the circle.</p>
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
        <h2 className="text-lg font-bold text-ink">Vocabulary terms</h2>
        <p className="text-sm text-ink-2 mt-1">
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
            <span key={t} className="text-xs px-2 py-0.5 rounded-full border border-line bg-surface text-ink-2">
              {t}
            </span>
          ))}
        </div>
      )}

      {previewQuestion && previewQuestion.prompt && terms.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-2">
            Live preview - Q1 prompt
          </p>
          <div className="bg-surface border border-line rounded-xl px-4 py-3 text-sm text-ink leading-relaxed">
            {linkifyGlossaryTerms(previewQuestion.prompt, terms)}
          </div>
          <p className="text-[11px] text-ink-3">Underlined terms open the glossary drawer in the member app.</p>
        </div>
      )}

      {(!previewQuestion?.prompt || terms.length === 0) && (
        <p className="text-sm text-ink-3">
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
        <h2 className="text-lg font-bold text-ink">Review & save</h2>
        <p className="text-sm text-ink-2 mt-1">
          Check the summary below, then save to staging. You can promote to production from the staging browser.
        </p>
      </div>

      <div className="bg-surface border border-line rounded-xl p-4 space-y-3 text-sm">
        <div className="grid grid-cols-[120px_1fr] gap-y-2 text-ink-2">
          <span className="font-semibold text-ink">Title</span>
          <span>{String(obj.title ?? '')}</span>
          <span className="font-semibold text-ink">Tag</span>
          <span>{String(obj.principle_tag ?? '')}</span>
          <span className="font-semibold text-ink">Concept</span>
          <span className="line-clamp-2">{String(obj.concept ?? '')}</span>
          {Boolean(obj.difficulty) && (
            <>
              <span className="font-semibold text-ink">Difficulty</span>
              <span>{String(obj.difficulty)}</span>
            </>
          )}
          <span className="font-semibold text-ink">Questions</span>
          <span>{questions.length}</span>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-2">Questions</p>
        {questions.map((q, i) => {
          const qObj = q as Record<string, unknown>
          const answers = (qObj.answers as unknown[]) ?? []
          const correctAnswer = answers.find((a) => (a as Record<string, unknown>).is_correct)
          return (
            <div key={i} className="bg-surface border border-line rounded-lg px-3 py-2 space-y-1">
              <p className="text-xs font-semibold text-gold">Q{i + 1} · {String(qObj.type ?? '')}</p>
              <p className="text-sm text-ink line-clamp-2">{String(qObj.prompt ?? '')}</p>
              {Boolean(correctAnswer) && (
                <p className="text-xs text-success">
                  ✓ {String((correctAnswer as Record<string, unknown>).text ?? '')}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-xl border border-error bg-error/10 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-error">Validation errors - fix before saving:</p>
          {validationErrors.map((e, i) => (
            <p key={i} className="text-xs text-error">{e}</p>
          ))}
        </div>
      )}

      {saveState.kind === 'done' && (
        <div className="rounded-xl border border-success bg-success/10 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-success">Saved to staging</p>
          <p className="text-xs text-ink-2 font-mono">{saveState.contentId}</p>
          <p className="text-xs text-ink-2">
            Go to Admin → Staging Browser to review and promote to production.
          </p>
        </div>
      )}

      {saveState.kind === 'error' && (
        <div className="rounded-xl border border-error bg-error/10 px-4 py-3">
          <p className="text-sm text-error">{saveState.message}</p>
        </div>
      )}

      {saveState.kind !== 'done' && (
        <button
          type="button"
          onClick={onSave}
          disabled={saveState.kind === 'saving' || validationErrors.length > 0}
          className="btn-primary w-full min-h-11 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saveState.kind === 'saving' ? 'Saving…' : 'Save to staging'}
        </button>
      )}
    </div>
  )
}

// ── Fullscreen step tabs ───────────────────────────────────────────────────────

function FullscreenStepIndicator({
  current,
  questionType,
}: {
  current: WizardStep
  questionType: 'multiple_choice' | 'hand_scenario'
}): JSX.Element {
  const currentIdx = ALL_STEPS.indexOf(current)
  return (
    <div className="flex border-b border-line overflow-x-auto scrollbar-hide">
      {ALL_STEPS.map((step, i) => {
        const isActive = step === current
        const isDone = i < currentIdx
        const isSkipped =
          (step === 'table' && questionType === 'multiple_choice') ||
          (step === 'qa' && questionType === 'hand_scenario')
        const label =
          step === 'table' && questionType === 'hand_scenario' ? 'Table & Q&A' : STEP_LABELS[step]
        const Icon = STEP_ICONS[step]
        return (
          <div
            key={step}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 shrink-0 transition-colors ${
              isActive
                ? 'border-gold text-gold'
                : isDone
                  ? 'border-transparent text-success'
                  : isSkipped
                    ? 'border-transparent text-line'
                    : 'border-transparent text-ink-3'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

// Draft persistence: the wizard keeps everything in memory, so a remount (e.g. an
// auth token refresh when the tab regains focus) would otherwise wipe in-progress
// work. We mirror the draft into sessionStorage and rehydrate on mount.
const WIZARD_DRAFT_KEY = 'bss_wizard_draft'

type WizardDraft = {
  title: string
  principleTag: string
  concept: string
  difficulty: string
  questionType: 'multiple_choice' | 'hand_scenario'
  completedQuestions: DraftQuestion[]
  currentQuestion: DraftQuestion
  editingIdx: number | null
  vocabInput: string
  step: WizardStep
}

// `embedded` renders the wizard inside a modal (no full-screen height, and the
// header action closes the modal instead of navigating away).
// `fullscreen` renders the wizard as a full-screen overlay with a fixed header/footer.
export function AuthoringWizardPage({
  embedded = false,
  fullscreen = false,
  onExit,
}: {
  embedded?: boolean
  fullscreen?: boolean
  onExit?: () => void
} = {}): JSX.Element {
  const navigate = useNavigate()

  // Rehydrate any in-progress draft saved before a remount (read once on mount).
  const savedDraft = useMemo<WizardDraft | null>(() => {
    try {
      const raw = sessionStorage.getItem(WIZARD_DRAFT_KEY)
      return raw ? (JSON.parse(raw) as WizardDraft) : null
    } catch {
      return null
    }
  }, [])

  // Step 1 state
  const [title, setTitle] = useState(savedDraft?.title ?? '')
  const [principleTag, setPrincipleTag] = useState(savedDraft?.principleTag ?? '')
  const [concept, setConcept] = useState(savedDraft?.concept ?? '')
  const [difficulty, setDifficulty] = useState(savedDraft?.difficulty ?? '')

  // Step 2 state
  const [questionType, setQuestionType] = useState<'multiple_choice' | 'hand_scenario'>(
    savedDraft?.questionType ?? 'multiple_choice',
  )

  // Steps 3-4 state
  const [completedQuestions, setCompletedQuestions] = useState<DraftQuestion[]>(
    savedDraft?.completedQuestions ?? [],
  )
  const [currentQuestion, setCurrentQuestion] = useState<DraftQuestion>(
    () => savedDraft?.currentQuestion ?? blankQuestion('multiple_choice', 0),
  )
  // null = writing a new question; number = editing existing question at that index
  const [editingIdx, setEditingIdx] = useState<number | null>(savedDraft?.editingIdx ?? null)

  // Step 5 state
  const [vocabInput, setVocabInput] = useState(savedDraft?.vocabInput ?? '')

  // Navigation
  const [step, setStep] = useState<WizardStep>(savedDraft?.step ?? 'lesson')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })

  // Mirror the draft to sessionStorage on every change so a tab-return remount
  // restores it. Cleared on successful save (see handleSave).
  useEffect(() => {
    const draft: WizardDraft = {
      title, principleTag, concept, difficulty, questionType,
      completedQuestions, currentQuestion, editingIdx, vocabInput, step,
    }
    try {
      sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // sessionStorage may be unavailable (private mode); persistence is best-effort.
    }
  }, [title, principleTag, concept, difficulty, questionType, completedQuestions, currentQuestion, editingIdx, vocabInput, step])

  const vocabTerms = vocabInput.split(',').map((t) => t.trim()).filter(Boolean)

  // When editing an existing question, substitute it in-place; otherwise append if started.
  const questionsForAssembly = editingIdx !== null
    ? completedQuestions.map((q, i) => i === editingIdx ? currentQuestion : q)
    : completedQuestions
  const assembled = assembleLesson(
    title, principleTag, concept, difficulty,
    questionType,
    questionsForAssembly,
    editingIdx !== null ? blankQuestion(questionType, 0) : currentQuestion,
    vocabTerms,
  )

  // When question type changes, reset question drafts
  function handleSetQuestionType(t: 'multiple_choice' | 'hand_scenario'): void {
    setQuestionType(t)
    setCompletedQuestions([])
    setCurrentQuestion(blankQuestion(t, 0))
    setEditingIdx(null)
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

  // Save currentQuestion into its slot (or append) and reset to a new blank question.
  function commitCurrent(questions: DraftQuestion[]): DraftQuestion[] {
    if (editingIdx !== null) {
      return questions.map((q, i) => i === editingIdx ? currentQuestion : q)
    }
    return [...questions, currentQuestion]
  }

  // Commit current question and start a new one
  function commitAndAddAnother(): boolean {
    const e = validateQuestion()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return false
    }
    setErrors({})
    setCompletedQuestions((prev) => commitCurrent(prev))
    setEditingIdx(null)
    setCurrentQuestion(blankQuestion(questionType, editingIdx !== null ? completedQuestions.length : completedQuestions.length + 1))
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
    // No-op if already editing this question - prevents confusing toggle
    if (editingIdx === idx) return
    setErrors({})
    // Auto-save current form state back to its slot before switching
    setCompletedQuestions((prev) => {
      if (editingIdx !== null) {
        // Save current edits back in-place
        return prev.map((q, i) => i === editingIdx ? currentQuestion : q)
      }
      // If writing a new question with content, append it first
      return currentQuestion.prompt.trim() ? [...prev, currentQuestion] : prev
    })
    setCurrentQuestion(completedQuestions[idx])
    setEditingIdx(idx)
    if (questionType === 'hand_scenario') setStep('table')
  }

  function handleDeleteCompleted(idx: number): void {
    if (editingIdx === idx) {
      // Deleting the question currently in the form - reset to new
      setEditingIdx(null)
      setCurrentQuestion(blankQuestion(questionType, completedQuestions.length - 1))
    } else if (editingIdx !== null && editingIdx > idx) {
      setEditingIdx(editingIdx - 1)
    }
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
      if (questionType === 'hand_scenario') {
        const e = validateQuestion()
        if (Object.keys(e).length > 0) { setErrors(e); return }
        setCompletedQuestions((prev) => commitCurrent(prev))
        setEditingIdx(null)
        setCurrentQuestion(blankQuestion(questionType, 0))
        setStep('vocab')
      } else {
        setStep('qa')
      }
      return
    }

    if (step === 'qa') {
      const e = validateQuestion()
      if (Object.keys(e).length > 0) { setErrors(e); return }
      setCompletedQuestions((prev) => commitCurrent(prev))
      setEditingIdx(null)
      setCurrentQuestion(blankQuestion(questionType, 0))
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
      if (completedQuestions.length > 0) {
        const lastIdx = completedQuestions.length - 1
        setEditingIdx(lastIdx)
        setCurrentQuestion(completedQuestions[lastIdx])
      }
      setStep(questionType === 'hand_scenario' ? 'table' : 'qa')
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
      // Draft is now saved to staging; drop the local copy so a new wizard starts clean.
      try {
        sessionStorage.removeItem(WIZARD_DRAFT_KEY)
      } catch {
        // ignore
      }
    }
  }

  const questionNumber = editingIdx !== null ? editingIdx + 1 : completedQuestions.length + 1
  const isFirstStep = step === 'lesson'
  const showContinue = step !== 'review'
  const stepIdx = ALL_STEPS.indexOf(step)
  const progressPct = Math.round(((stepIdx + 1) / ALL_STEPS.length) * 100)

  // ── Shared step content ──────────────────────────────────────────────────────
  const stepContent = (
    <>
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
      {step === 'table' && questionType === 'hand_scenario' && (
        <StepTableAndQA
          tableState={currentQuestion.table_state ?? { ...INITIAL_TABLE }}
          onTableState={(s) => setCurrentQuestion({ ...currentQuestion, table_state: s })}
          question={currentQuestion}
          onQuestion={setCurrentQuestion}
          completedQuestions={completedQuestions}
          editingIdx={editingIdx}
          onEditCompleted={handleEditCompleted}
          onDeleteCompleted={handleDeleteCompleted}
          errors={errors}
          questionNumber={questionNumber}
        />
      )}
      {step === 'table' && questionType !== 'hand_scenario' && (
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
          editingIdx={editingIdx}
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
    </>
  )

  // ── Shared nav buttons ───────────────────────────────────────────────────────
  const navButtons = (
    <>
      {!isFirstStep && (
        <button
          type="button"
          onClick={handleBack}
          disabled={saveState.kind === 'saving' || saveState.kind === 'done'}
          className="btn-secondary min-h-11 disabled:opacity-40"
        >
          ← Back
        </button>
      )}
      {(step === 'qa' || (step === 'table' && questionType === 'hand_scenario')) && (
        <button
          type="button"
          onClick={handleAddAnother}
          className="btn-secondary min-h-11"
        >
          + Add another question
        </button>
      )}
      {showContinue && (
        <button
          type="button"
          onClick={handleContinue}
          className="btn-primary min-h-11 ml-auto"
        >
          {(step === 'qa' || (step === 'table' && questionType === 'hand_scenario'))
            ? 'Done with questions →'
            : step === 'vocab'
              ? 'Review →'
              : 'Continue →'}
        </button>
      )}
    </>
  )

  // ── Fullscreen layout ────────────────────────────────────────────────────────
  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-canvas text-ink">
        {/* Thin gold progress bar */}
        <div className="h-0.5 bg-line shrink-0">
          <div
            className="h-full bg-gold transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center px-6 py-4 border-b border-line shrink-0 relative">
          <button
            type="button"
            onClick={() => (onExit ? onExit() : navigate('/admin/dashboard'))}
            aria-label="Close wizard"
            className="p-2 rounded-lg text-ink-2 hover:text-ink hover:bg-surface-overlay transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <p className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-ink-2">
            Step {stepIdx + 1} of {ALL_STEPS.length}
          </p>
        </div>

        {/* Step tabs */}
        <FullscreenStepIndicator current={step} questionType={questionType} />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className={`mx-auto px-6 py-8 space-y-6 ${step === 'table' ? 'max-w-3xl' : 'max-w-2xl'}`}>
            <div className="bg-surface border border-line rounded-2xl px-4 py-6 sm:px-6">
              {stepContent}
            </div>
          </div>
        </div>

        {/* Fixed footer */}
        <div className="border-t border-line px-6 py-4 flex items-center gap-3 shrink-0 bg-canvas">
          {navButtons}
        </div>
      </div>
    )
  }

  // ── Regular (embedded or standalone) layout ──────────────────────────────────
  return (
    <div className={`${embedded ? '' : 'min-h-screen'} space-y-8 max-w-2xl text-ink`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-gold">
            Admin · Content Studio
          </p>
          <h1 className="text-2xl font-bold mt-1 text-ink">New Lesson Wizard</h1>
        </div>
        <button
          type="button"
          onClick={() => (embedded && onExit ? onExit() : navigate('/admin'))}
          className="text-sm text-ink-2 hover:text-ink shrink-0 mt-1 transition-colors"
        >
          {embedded ? '✕ Close' : '← Back to admin'}
        </button>
      </div>

      {/* Step indicator */}
      <div className="overflow-x-auto -mx-1 px-1">
        <StepIndicator current={step} questionType={questionType} />
      </div>

      {/* Step content */}
      <div className="bg-surface border border-line rounded-2xl p-6">
        {stepContent}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-3">
        {navButtons}
      </div>
    </div>
  )
}
