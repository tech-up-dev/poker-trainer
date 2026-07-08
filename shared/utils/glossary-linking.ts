import type { Lesson, Question } from '../schemas/lesson.ts'

// Shared glossary auto-linking (M2). Given the full set of glossary terms in an
// environment, this decides which of them appear in a lesson's question/answer
// text and writes them into each question's `glossary_terms` (the explicit
// allow-list the render layer linkifies).
//
// It is a full recompute, not a merge: a question's `glossary_terms` is replaced
// with exactly the terms that currently match. That is deliberate - a term that
// has no glossary entry carries no value, and it also makes rename/delete "just
// work": recomputing a lesson against the current term list drops a removed or
// renamed term without any special-case logic.
//
// Used both on lesson save (recompute one lesson) and on glossary save/delete
// (recompute every lesson in that environment), against the staging term list
// for staging writes and the production term list on promote.

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Whole-word / whole-phrase, case-insensitive test. Unicode letter/number
// lookarounds anchor both edges so "equity" does not match inside "inequity",
// while multi-word terms ("fold equity") and terms with punctuation ("3-bet")
// still match as a unit.
function termAppears(text: string, term: string): boolean {
  const escaped = escapeRegExp(term.trim())
  if (!escaped) return false
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu')
  return pattern.test(text)
}

// The searchable text of a question: its prompt plus every answer's text and
// explanation. Joined with newlines so terms never span two fields by accident.
function questionText(question: Question): string {
  const parts = [question.prompt]
  for (const answer of question.answers) {
    parts.push(answer.text, answer.explanation)
  }
  return parts.join('\n')
}

// The subset of `terms` that appear as whole words in `text`, sorted for a stable
// output so re-saving identical content is a no-op (the pipeline compares a
// canonical stringification for idempotency).
export function matchTermsInText(text: string, terms: string[]): string[] {
  const matched = terms.filter((term) => termAppears(text, term))
  return [...new Set(matched)].sort((a, b) => a.localeCompare(b))
}

// Returns a copy of the lesson with every question's `glossary_terms` recomputed
// from `terms`. Questions with no matches have the field removed entirely.
export function applyGlossaryLinks(lesson: Lesson, terms: string[]): Lesson {
  return {
    ...lesson,
    questions: lesson.questions.map((question) => {
      const matched = matchTermsInText(questionText(question), terms)
      // Full recompute: set the fresh list, or drop the field when nothing matches.
      const next: Question = { ...question }
      if (matched.length > 0) {
        next.glossary_terms = matched
      } else {
        delete next.glossary_terms
      }
      return next
    }),
  }
}
