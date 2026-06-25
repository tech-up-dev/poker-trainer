import type { JSX } from 'react'

import type { Lesson, Question } from '../../shared/schemas/lesson'

// Renders a single piece of content for the read-only side panels. Lessons get a
// structured view; every other content type falls back to pretty-printed JSON.
// Shared by the Staging and Production panels so they render identically.
export function ContentBody({
  content,
  contentType,
}: {
  content: unknown
  contentType: string
}): JSX.Element {
  if (contentType === 'lesson') {
    const lesson = content as Lesson
    return (
      <div className="space-y-3">
        <div className="text-sm text-slate-400">
          <span className="text-slate-200">{lesson.title}</span> ·{' '}
          {lesson.questions.length} questions
          {lesson.difficulty !== undefined ? ` · ${lesson.difficulty}` : ''}
        </div>
        <ul className="space-y-3">
          {lesson.questions.map((question, index) => (
            <li key={question.question_id}>
              <QuestionCard question={question} index={index} />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <pre className="text-xs text-slate-300 bg-slate-950 border border-slate-700 rounded p-4 overflow-x-auto whitespace-pre-wrap break-words">
      {JSON.stringify(content, null, 2)}
    </pre>
  )
}

type QuestionCardProps = { question: Question; index: number }

function QuestionCard({ question, index }: QuestionCardProps): JSX.Element {
  return (
    <article className="rounded border border-slate-700 bg-slate-950/60 p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-mono text-slate-400">Q{index + 1}</span>
        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
          {question.type}
        </span>
        <span className="font-mono text-slate-500">{question.question_id}</span>
      </header>
      <p className="text-sm text-slate-100 leading-relaxed">{question.prompt}</p>
      <ul className="space-y-2 text-sm">
        {question.answers.map((answer, i) => (
          <li
            key={i}
            className={
              answer.is_correct
                ? 'pl-3 border-l-2 border-green-500'
                : 'pl-3 border-l-2 border-slate-700'
            }
          >
            <div
              className={
                answer.is_correct
                  ? 'text-green-300 font-medium'
                  : 'text-slate-300'
              }
            >
              {answer.is_correct ? '✓ ' : ''}
              {answer.text}
            </div>
            <div className="text-xs text-slate-500 leading-relaxed">
              {answer.explanation}
            </div>
          </li>
        ))}
      </ul>
      {question.type === 'hand_scenario' && question.table_state !== undefined ? (
        <TableStateView state={question.table_state} />
      ) : null}
      {question.glossary_terms !== undefined && question.glossary_terms.length > 0 ? (
        <div className="flex flex-wrap gap-1 text-xs">
          {question.glossary_terms.map((term) => (
            <span
              key={term}
              className="px-2 py-0.5 rounded bg-slate-800 text-slate-400"
            >
              {term}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

type TableState = NonNullable<Question['table_state']>

function TableStateView({ state }: { state: TableState }): JSX.Element {
  return (
    <details className="text-xs text-slate-400">
      <summary className="cursor-pointer hover:text-slate-300">
        table_state · {state.street} · {state.hero_position}
      </summary>
      <pre className="mt-2 p-2 rounded bg-slate-900 border border-slate-800 overflow-x-auto text-slate-300">
        {JSON.stringify(state, null, 2)}
      </pre>
    </details>
  )
}
