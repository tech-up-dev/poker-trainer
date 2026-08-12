import type { Lesson } from '../schemas/lesson.ts'

// Field-pathed errors for any question tagged with a `concept` that is not in the
// managed vocabulary (the `concepts` table). `concept` is the one OPEN taxonomy,
// so it can't be a Zod enum. The closed sets (principle/player_type/street/
// difficulty) are already enforced by the schema; this covers only concept.
//
// Concept is optional, so a question without one is skipped here (requiring it is
// a later, M3-12, step). Full recompute each call: pass the current vocabulary.
export function unknownConceptIssues(
  lesson: Lesson,
  validConcepts: Set<string>,
): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = []
  lesson.questions.forEach((question, index) => {
    const concept = question.concept
    if (typeof concept === 'string' && concept.length > 0 && !validConcepts.has(concept)) {
      issues.push({
        path: `questions.${index}.concept`,
        message: `Unknown concept "${concept}": pick one from the managed vocabulary.`,
      })
    }
  })
  return issues
}
