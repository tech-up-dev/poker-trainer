import { useState, useEffect, useMemo } from 'react'
import type { JSX, ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X, Tag, HelpCircle, BookText, Download } from 'lucide-react'

import { LessonSchema } from '../../shared/schemas/lesson'
import type { HandScenarioState } from '../../shared/schemas/lesson'
import { supabaseProd } from '../lib/supabase-prod'
import { TableBuilder } from '../components/TableBuilder'
import { linkifyGlossaryTerms } from '../lib/glossary-text'

// ── Types ─────────────────────────────────────────────────────────────────────

type WizardStep = 'lesson' | 'questions' | 'vocab' | 'review'

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
  lesson:    'Lesson',
  questions: 'Questions',
  vocab:     'Vocab',
  review:    'Export',
}

const STEP_ICONS: Record<WizardStep, typeof Tag> = {
  lesson:    Tag,
  questions: HelpCircle,
  vocab:     BookText,
  review:    Download,
}

const ALL_STEPS: WizardStep[] = ['lesson', 'questions', 'vocab', 'review']

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

function prevStep(step: WizardStep): WizardStep {
  if (step === 'questions') return 'lesson'
  if (step === 'vocab') return 'questions'
  if (step === 'review') return 'vocab'
  return 'lesson'
}

function assembleLesson(
  title: string,
  principleTag: string,
  concept: string,
  difficulty: string,
  lessonId: string,
  completedQuestions: DraftQuestion[],
  currentQuestion: DraftQuestion,
  vocabTerms: string[],
): unknown {
  // Only include currentQuestion if the user has started filling it in.
  const allQuestions = currentQuestion.prompt.trim()
    ? [...completedQuestions, currentQuestion]
    : [...completedQuestions]
  return {
    ...(lessonId ? { lesson_id: lessonId } : {}),
    title: title.trim(),
    principle_tag: principleTag.trim(),
    concept: concept.trim(),
    ...(difficulty ? { difficulty } : {}),
    questions: allQuestions.map((q, i) => ({
      question_id: `q-${i + 1}`,
      type: q.type,
      prompt: q.prompt.trim(),
      answers: q.answers.map((a) => ({
        text: a.text.trim(),
        is_correct: a.is_correct,
        explanation: a.explanation.trim(),
      })),
      ...(q.type === 'hand_scenario' && q.table_state ? { table_state: q.table_state } : {}),
      ...(vocabTerms.length > 0 ? { glossary_terms: vocabTerms } : {}),
    })),
  }
}

// Convert a saved lesson JSON back into wizard draft state so it can be re-edited.
function lessonToWizardDraft(lesson: unknown): WizardDraft {
  const l = lesson as Record<string, unknown>
  const rawQuestions = (l.questions as unknown[]) ?? []
  const completedQuestions: DraftQuestion[] = rawQuestions.map((q, i) => {
    const qObj = q as Record<string, unknown>
    const rawAnswers = (qObj.answers as unknown[]) ?? []
    const answers = rawAnswers.map((a) => {
      const aObj = a as Record<string, unknown>
      return {
        text: String(aObj.text ?? ''),
        is_correct: Boolean(aObj.is_correct),
        explanation: String(aObj.explanation ?? ''),
      }
    })
    while (answers.length < 4) answers.push(blankAnswer())
    return {
      _id: `q-${Date.now()}-${i}`,
      type: ((qObj.type as string) === 'hand_scenario'
        ? 'hand_scenario'
        : 'multiple_choice') as 'multiple_choice' | 'hand_scenario',
      table_state: qObj.table_state as HandScenarioState | undefined,
      prompt: String(qObj.prompt ?? ''),
      answers: answers.slice(0, 4) as [DraftAnswer, DraftAnswer, DraftAnswer, DraftAnswer],
    }
  })
  const firstType = completedQuestions[0]?.type ?? 'multiple_choice'
  const vocabTerms =
    ((rawQuestions[0] as Record<string, unknown>)?.glossary_terms as string[] | undefined) ?? []
  return {
    title: String(l.title ?? ''),
    principleTag: String(l.principle_tag ?? ''),
    concept: String(l.concept ?? ''),
    difficulty: String(l.difficulty ?? ''),
    lessonId: String(l.lesson_id ?? ''),
    questionType: firstType,
    completedQuestions,
    currentQuestion: blankQuestion(firstType, completedQuestions.length),
    editingIdx: null,
    vocabInput: vocabTerms.join(', '),
    step: 'lesson',
  }
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}): JSX.Element {
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

// ── Step indicator (non-fullscreen) ───────────────────────────────────────────

function StepIndicator({
  current,
  onStepClick,
}: {
  current: WizardStep
  onStepClick: (step: WizardStep) => void
}): JSX.Element {
  const currentIdx = ALL_STEPS.indexOf(current)
  return (
    <div className="flex items-center w-full">
      {ALL_STEPS.map((step, i) => {
        const isActive = step === current
        const isDone = i < currentIdx
        const isClickable = i < currentIdx
        return (
          <div key={step} className="flex items-center flex-1 min-w-0">
            <button
              type="button"
              disabled={!isClickable}
              onClick={() => isClickable && onStepClick(step)}
              className={`flex flex-col items-center gap-1 shrink-0 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors ${
                  isActive
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
                  isActive ? 'text-gold' : isDone ? 'text-success' : 'text-ink-3'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
            </button>
            {i < ALL_STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mb-5 mx-1 ${i < currentIdx ? 'bg-success' : 'bg-line'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Fullscreen step tabs ───────────────────────────────────────────────────────

function FullscreenStepIndicator({
  current,
  onStepClick,
}: {
  current: WizardStep
  onStepClick: (step: WizardStep) => void
}): JSX.Element {
  const currentIdx = ALL_STEPS.indexOf(current)
  return (
    <div className="flex border-b border-line overflow-x-auto scrollbar-hide">
      {ALL_STEPS.map((step, i) => {
        const isActive = step === current
        const isDone = i < currentIdx
        const isClickable = i < currentIdx
        const Icon = STEP_ICONS[step]
        return (
          <button
            key={step}
            type="button"
            disabled={!isClickable}
            onClick={() => isClickable && onStepClick(step)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 shrink-0 transition-colors ${
              isActive
                ? 'border-gold text-gold'
                : isDone
                  ? 'border-transparent text-success hover:text-ink cursor-pointer'
                  : 'border-transparent text-ink-3 cursor-default'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{STEP_LABELS[step]}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── Step 1: Lesson metadata ───────────────────────────────────────────────────

function StepLesson({
  title,
  principleTag,
  concept,
  difficulty,
  onTitle,
  onPrincipleTag,
  onConcept,
  onDifficulty,
  errors,
}: {
  title: string
  principleTag: string
  concept: string
  difficulty: string
  onTitle: (v: string) => void
  onPrincipleTag: (v: string) => void
  onConcept: (v: string) => void
  onDifficulty: (v: string) => void
  errors: Record<string, string>
}): JSX.Element {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-ink">Lesson details</h2>
        <p className="text-sm text-ink-2 mt-1">
          Fill in the lesson metadata. Title, tag and concept are required.
        </p>
      </div>

      <Field label="Title *" error={errors.title}>
        <AdminInput
          value={title}
          onChange={onTitle}
          placeholder="e.g. Pre-flop Opens from UTG"
          hasError={!!errors.title}
        />
      </Field>

      <Field label="Principle tag *" error={errors.principle_tag}>
        <AdminInput
          value={principleTag}
          onChange={onPrincipleTag}
          placeholder="e.g. opening_ranges_utg"
          hasError={!!errors.principle_tag}
        />
      </Field>

      <Field label="Concept / intro *" error={errors.concept}>
        <AdminTextarea
          value={concept}
          onChange={onConcept}
          placeholder="One-sentence description shown on the lesson card and intro screen."
          rows={2}
          hasError={!!errors.concept}
        />
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

// ── Step 2: Questions (type selector + table + Q&A, all in one) ───────────────

function StepQuestions({
  questionType,
  onQuestionType,
  question,
  onQuestion,
  completedQuestions,
  editingIdx,
  onEditCompleted,
  onDeleteCompleted,
  errors,
  questionNumber,
}: {
  questionType: 'multiple_choice' | 'hand_scenario'
  onQuestionType: (v: 'multiple_choice' | 'hand_scenario') => void
  question: DraftQuestion
  onQuestion: (q: DraftQuestion) => void
  completedQuestions: DraftQuestion[]
  editingIdx: number | null
  onEditCompleted: (idx: number) => void
  onDeleteCompleted: (idx: number) => void
  errors: Record<string, string>
  questionNumber: number
}): JSX.Element {
  const tableState = question.table_state ?? { ...INITIAL_TABLE }
  const correctIdx = question.answers.findIndex((a) => a.is_correct)

  function setPrompt(v: string): void {
    onQuestion({ ...question, prompt: v })
  }

  function setAnswerField(i: number, field: keyof DraftAnswer, value: string | boolean): void {
    const next = question.answers.map((a, idx) => {
      if (field === 'is_correct') return { ...a, is_correct: idx === i }
      return idx === i ? { ...a, [field]: value } : a
    }) as [DraftAnswer, DraftAnswer, DraftAnswer, DraftAnswer]
    onQuestion({ ...question, answers: next })
  }

  return (
    <div className="space-y-6">
      {/* ── Completed questions list ── */}
      {completedQuestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-2">
            Questions added ({completedQuestions.length})
          </p>
          {completedQuestions.map((q, i) => {
            const isEditing = editingIdx === i
            return (
              <div
                key={q._id}
                className={`flex items-start justify-between gap-3 rounded-lg px-3 py-2 border ${
                  isEditing ? 'border-gold bg-gold/10' : 'bg-surface border-line'
                }`}
              >
                <p className="text-xs text-ink-2 line-clamp-2 flex-1">
                  <span className="font-semibold mr-1 text-gold">Q{i + 1}.</span>
                  {isEditing ? (
                    <em className="text-gold">Editing…</em>
                  ) : (
                    q.prompt || <em className="text-ink-3">No prompt</em>
                  )}
                </p>
                <div className="flex gap-2 shrink-0">
                  {isEditing ? (
                    <span className="text-[11px] text-gold">Editing</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEditCompleted(i)}
                      className="text-[11px] text-link hover:underline"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteCompleted(i)}
                    className="text-[11px] text-error hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
          <div className="border-t border-line" />
        </div>
      )}

      {/* ── Type selector ── */}
      <div className="space-y-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold">
            Question {questionNumber}
          </p>
          <h2 className="text-lg font-bold text-ink mt-0.5">Question type</h2>
          <p className="text-sm text-ink-2 mt-1">Choose the format for this question.</p>
        </div>
        <div className="flex gap-3">
          {(
            [
              {
                value: 'multiple_choice' as const,
                label: 'General Q&A',
                desc: 'Text-only question, no table.',
              },
              {
                value: 'hand_scenario' as const,
                label: 'Hand Scenario',
                desc: 'Includes visual poker table.',
              },
            ] as const
          ).map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => onQuestionType(value)}
              className={`flex-1 text-left p-3 rounded-xl border transition-colors ${
                questionType === value
                  ? 'border-gold bg-gold/10'
                  : 'border-line bg-surface hover:border-link'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    questionType === value ? 'border-gold bg-gold' : 'border-ink-3'
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold text-ink">{label}</p>
                  <p className="text-xs text-ink-2">{desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Table builder (hand_scenario only) ── */}
      {questionType === 'hand_scenario' && (
        <>
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-ink">Configure the table</h2>
              <p className="text-sm text-ink-2 mt-1">
                Set up the hand scenario: street, positions, hole cards, board, villains.
              </p>
            </div>
            <TableBuilder
              value={tableState}
              onChange={(s) => onQuestion({ ...question, table_state: s })}
            />
          </div>
          <div className="border-t border-line" />
        </>
      )}

      {/* ── Q&A form ── */}
      <div className="space-y-5">
        <h2 className="text-lg font-bold text-ink">Write the Q&A</h2>

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

// ── Step 3: Vocab / glossary terms ────────────────────────────────────────────

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
          Enter glossary terms that appear in your questions. Members tap them to open the
          definition. Optional.
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
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded-full border border-line bg-surface text-ink-2"
            >
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
          <p className="text-[11px] text-ink-3">
            Underlined terms open the glossary drawer in the member app.
          </p>
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

// ── Step 4: Review + Save ─────────────────────────────────────────────────────

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
          Check the summary below, then save to staging. You can promote to production from the
          staging browser.
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
              <p className="text-xs font-semibold text-gold">
                Q{i + 1} · {String(qObj.type ?? '')}
              </p>
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
            <p key={i} className="text-xs text-error">
              {e}
            </p>
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

// ── Main page ─────────────────────────────────────────────────────────────────

const WIZARD_DRAFT_KEY = 'bss_wizard_draft'

type WizardDraft = {
  title: string
  principleTag: string
  concept: string
  difficulty: string
  lessonId: string
  questionType: 'multiple_choice' | 'hand_scenario'
  completedQuestions: DraftQuestion[]
  currentQuestion: DraftQuestion
  editingIdx: number | null
  vocabInput: string
  step: WizardStep
}

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
  const location = useLocation()

  const locState = location.state as {
    newLesson?: boolean
    preloadContent?: unknown
  } | null

  // Don't persist sessionStorage drafts when editing from staging — so that
  // navigating to /admin/wizard from the sidebar afterwards starts fresh.
  const isEditMode = Boolean(locState?.preloadContent)

  // Rehydrate draft on mount. Priority:
  // 1. embedded mode - always start fresh
  // 2. newLesson flag - start fresh, clear any saved draft
  // 3. preloadContent - seed from a staged lesson (edit-in-wizard)
  // 4. sessionStorage - restore an in-progress draft after tab refresh
  const savedDraft = useMemo<WizardDraft | null>(() => {
    if (embedded) return null
    if (locState?.newLesson) {
      try { sessionStorage.removeItem(WIZARD_DRAFT_KEY) } catch { /* ignore */ }
      return null
    }
    if (locState?.preloadContent) {
      return lessonToWizardDraft(locState.preloadContent)
    }
    try {
      const raw = sessionStorage.getItem(WIZARD_DRAFT_KEY)
      return raw ? (JSON.parse(raw) as WizardDraft) : null
    } catch {
      return null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- intentionally read once on mount

  const [title, setTitle] = useState(savedDraft?.title ?? '')
  const [principleTag, setPrincipleTag] = useState(savedDraft?.principleTag ?? '')
  const [concept, setConcept] = useState(savedDraft?.concept ?? '')
  const [difficulty, setDifficulty] = useState(savedDraft?.difficulty ?? '')
  const [lessonId] = useState(savedDraft?.lessonId ?? '')

  const [questionType, setQuestionType] = useState<'multiple_choice' | 'hand_scenario'>(
    savedDraft?.questionType ?? 'multiple_choice',
  )

  const [completedQuestions, setCompletedQuestions] = useState<DraftQuestion[]>(
    savedDraft?.completedQuestions ?? [],
  )
  const [currentQuestion, setCurrentQuestion] = useState<DraftQuestion>(
    () => savedDraft?.currentQuestion ?? blankQuestion('multiple_choice', 0),
  )
  const [editingIdx, setEditingIdx] = useState<number | null>(savedDraft?.editingIdx ?? null)

  const [vocabInput, setVocabInput] = useState(savedDraft?.vocabInput ?? '')

  const [step, setStep] = useState<WizardStep>(savedDraft?.step ?? 'lesson')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' })

  // Mirror the draft to sessionStorage on every change so a tab-return remount
  // restores it. Skip when in edit-from-staging mode so the sidebar always starts fresh.
  useEffect(() => {
    if (embedded || isEditMode) return
    const draft: WizardDraft = {
      title, principleTag, concept, difficulty, lessonId, questionType,
      completedQuestions, currentQuestion, editingIdx, vocabInput, step,
    }
    try {
      sessionStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // sessionStorage may be unavailable in private mode; persistence is best-effort.
    }
  }, [title, principleTag, concept, difficulty, questionType, completedQuestions, currentQuestion, editingIdx, vocabInput, step, embedded, isEditMode])

  const vocabTerms = vocabInput.split(',').map((t) => t.trim()).filter(Boolean)

  // When editing an existing question, substitute it in-place; otherwise append if started.
  const questionsForAssembly =
    editingIdx !== null
      ? completedQuestions.map((q, i) => (i === editingIdx ? currentQuestion : q))
      : completedQuestions

  const assembled = assembleLesson(
    title, principleTag, concept, difficulty, lessonId,
    questionsForAssembly,
    editingIdx !== null ? blankQuestion(questionType, 0) : currentQuestion,
    vocabTerms,
  )

  function handleSetQuestionType(t: 'multiple_choice' | 'hand_scenario'): void {
    setQuestionType(t)
    setCurrentQuestion(blankQuestion(t, completedQuestions.length))
    setEditingIdx(null)
  }

  function validateLesson(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Title is required'
    if (!principleTag.trim()) e.principle_tag = 'Principle tag is required'
    if (!concept.trim()) e.concept = 'Concept is required'
    return e
  }

  function validateQuestion(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!currentQuestion.prompt.trim()) e.prompt = 'Question prompt is required'
    currentQuestion.answers.forEach((a, i) => {
      if (!a.text.trim()) e[`answer_${i}_text`] = `Answer ${LETTERS[i]} text is required`
      if (!a.explanation.trim())
        e[`answer_${i}_explanation`] = `Answer ${LETTERS[i]} explanation is required`
    })
    const correctCount = currentQuestion.answers.filter((a) => a.is_correct).length
    if (correctCount !== 1) e.answers = 'Exactly one answer must be marked correct'
    return e
  }

  function commitCurrent(questions: DraftQuestion[]): DraftQuestion[] {
    if (editingIdx !== null) {
      return questions.map((q, i) => (i === editingIdx ? currentQuestion : q))
    }
    return [...questions, currentQuestion]
  }

  function commitAndAddAnother(): boolean {
    const e = validateQuestion()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      return false
    }
    setErrors({})
    setCompletedQuestions((prev) => commitCurrent(prev))
    setEditingIdx(null)
    setCurrentQuestion(
      blankQuestion(
        questionType,
        editingIdx !== null ? completedQuestions.length : completedQuestions.length + 1,
      ),
    )
    return true
  }

  function handleAddAnother(): void {
    if (!commitAndAddAnother()) return
    // Stay on questions step; form resets to a blank new question
  }

  function handleEditCompleted(idx: number): void {
    if (editingIdx === idx) return
    setErrors({})
    // Auto-save current form state before switching
    setCompletedQuestions((prev) => {
      if (editingIdx !== null) {
        return prev.map((q, i) => (i === editingIdx ? currentQuestion : q))
      }
      return currentQuestion.prompt.trim() ? [...prev, currentQuestion] : prev
    })
    const target = completedQuestions[idx]
    setCurrentQuestion(target)
    setQuestionType(target.type)
    setEditingIdx(idx)
  }

  function handleDeleteCompleted(idx: number): void {
    if (editingIdx === idx) {
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
      setStep('questions')
      return
    }

    if (step === 'questions') {
      // No questions at all: require at least one
      if (!currentQuestion.prompt.trim() && completedQuestions.length === 0) {
        setErrors({ prompt: 'Add at least one question before continuing.' })
        return
      }
      // Blank form but existing questions: proceed
      if (!currentQuestion.prompt.trim() && completedQuestions.length > 0 && editingIdx === null) {
        setStep('vocab')
        return
      }
      // Has content: validate and commit
      const e = validateQuestion()
      if (Object.keys(e).length > 0) { setErrors(e); return }
      setCompletedQuestions((prev) => commitCurrent(prev))
      setEditingIdx(null)
      setCurrentQuestion(blankQuestion(questionType, completedQuestions.length + 1))
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
    setStep(prevStep(step))
  }

  function handleStepClick(s: WizardStep): void {
    setErrors({})
    setStep(s)
  }

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
      try { sessionStorage.removeItem(WIZARD_DRAFT_KEY) } catch { /* ignore */ }
      // Brief delay so the user sees the success state, then navigate to staging
      setTimeout(() => {
        if (onExit) {
          onExit()
        } else {
          navigate('/admin/staging')
        }
      }, 1200)
    }
  }

  const questionNumber = editingIdx !== null ? editingIdx + 1 : completedQuestions.length + 1
  const isFirstStep = step === 'lesson'
  const showContinue = step !== 'review'
  const stepIdx = ALL_STEPS.indexOf(step)
  const progressPct = Math.round(((stepIdx + 1) / ALL_STEPS.length) * 100)

  const stepContent = (
    <>
      {step === 'lesson' && (
        <StepLesson
          title={title}
          principleTag={principleTag}
          concept={concept}
          difficulty={difficulty}
          onTitle={setTitle}
          onPrincipleTag={setPrincipleTag}
          onConcept={setConcept}
          onDifficulty={setDifficulty}
          errors={errors}
        />
      )}
      {step === 'questions' && (
        <StepQuestions
          questionType={questionType}
          onQuestionType={handleSetQuestionType}
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
      {step === 'questions' && (
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
          {step === 'questions'
            ? completedQuestions.length > 0 || currentQuestion.prompt.trim()
              ? 'Done with questions →'
              : 'Continue →'
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
        <div className="h-0.5 bg-line shrink-0">
          <div
            className="h-full bg-gold transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

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

        <FullscreenStepIndicator current={step} onStepClick={handleStepClick} />

        <div className="flex-1 overflow-y-auto">
          <div
            className={`mx-auto px-6 py-8 space-y-6 ${
              step === 'questions' ? 'max-w-3xl' : 'max-w-2xl'
            }`}
          >
            <div className="bg-surface border border-line rounded-2xl px-4 py-6 sm:px-6">
              {stepContent}
            </div>
          </div>
        </div>

        <div className="border-t border-line px-6 py-4 flex items-center gap-3 shrink-0 bg-canvas">
          {navButtons}
        </div>
      </div>
    )
  }

  // ── Regular (embedded or standalone) layout ──────────────────────────────────
  return (
    <div className={`${embedded ? '' : 'min-h-screen'} space-y-8 max-w-2xl text-ink`}>
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

      <div className="overflow-x-auto -mx-1 px-1">
        <StepIndicator current={step} onStepClick={handleStepClick} />
      </div>

      <div className="bg-surface border border-line rounded-2xl p-6">
        {stepContent}
      </div>

      <div className="flex items-center gap-3">
        {navButtons}
      </div>
    </div>
  )
}
