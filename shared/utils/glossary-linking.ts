import type { Lesson, Question } from '../schemas/lesson.ts'

// Shared glossary auto-linking (M2). Given the full set of glossary terms in an
// environment, this decides which of them appear in a lesson's question/answer
// text and writes them into each question's `glossary_terms` (the explicit
// allow-list the render layer linkifies).
//
// Behaviour is a MERGE of (a) terms the author explicitly attached to the
// question in the wizard and (b) terms auto-detected in the question text.
// Explicitly-attached terms that no longer exist in the glossary (renamed or
// deleted) are dropped, so rename/delete still "just works" against the current
// term list. This replaced the earlier full-recompute behaviour, which silently
// discarded any manually attached terms whose exact string didn't appear in the
// question text (reported by wizard user when they attached "c-bet" to a
// question whose text used "continuation bet" and the field vanished).
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

// Returns a copy of the lesson with every question's `glossary_terms` set to
// the union of (a) terms the author explicitly attached that still exist in
// `terms` (i.e. still in the glossary), and (b) terms auto-detected in the
// question text via `matchTermsInText`. Questions ending up empty have the
// field removed entirely.
export function applyGlossaryLinks(lesson: Lesson, terms: string[]): Lesson {
  const validSet = new Set(terms)
  return {
    ...lesson,
    questions: lesson.questions.map((question) => {
      const provided = Array.isArray(question.glossary_terms) ? question.glossary_terms : []
      const preserved = provided.filter((t): t is string => typeof t === 'string' && validSet.has(t))
      const matched = matchTermsInText(questionText(question), terms)
      const merged = [...new Set([...preserved, ...matched])].sort((a, b) => a.localeCompare(b))
      const next: Question = { ...question }
      if (merged.length > 0) {
        next.glossary_terms = merged
      } else {
        delete next.glossary_terms
      }
      return next
    }),
  }
}
