import { LessonSchema, type Lesson } from '../../shared/schemas/lesson'
import { GlossaryEntrySchema, type GlossaryEntry } from '../../shared/schemas/glossary'
import { contentRegistry, type ContentType } from '../../shared/schemas/content'

export type FieldError = { path: string; message: string }

export type ValidationResult = { ok: true; data: Lesson } | { ok: false; errors: FieldError[] }

export type GlossaryValidationResult =
  { ok: true; data: GlossaryEntry } | { ok: false; errors: FieldError[] }

export function validateLesson(input: unknown): ValidationResult {
  const result = LessonSchema.safeParse(input)
  if (result.success) return { ok: true, data: result.data }

  const errors: FieldError[] = result.error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }))
  return { ok: false, errors }
}

export function validateGlossary(input: unknown): GlossaryValidationResult {
  const result = GlossaryEntrySchema.safeParse(input)
  if (result.success) return { ok: true, data: result.data }

  const errors: FieldError[] = result.error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }))
  return { ok: false, errors }
}

export type DetectResult =
  { ok: true; contentType: ContentType; data: unknown } | { ok: false; errors: FieldError[] }

// Auto-detect which content type an item is by trying each candidate schema in
// order. The schemas' required fields are discriminating enough that a real item
// matches at most one. On no match we surface the errors from the closest
// candidate (fewest issues) so the author sees the most useful message.
export function detectAndValidate(
  input: unknown,
  candidates: readonly ContentType[],
): DetectResult {
  let best: { count: number; errors: FieldError[] } | null = null

  for (const contentType of candidates) {
    const result = contentRegistry[contentType].schema.safeParse(input)
    if (result.success) return { ok: true, contentType, data: result.data }

    const issues = result.error.issues
    if (best === null || issues.length < best.count) {
      best = {
        count: issues.length,
        errors: issues.map((issue) => ({
          path: formatPath(issue.path),
          message: issue.message,
        })),
      }
    }
  }

  return { ok: false, errors: best?.errors ?? [] }
}

// Convert Zod paths like ["questions", 2, "answers"] into "question 3, answers"
// (1-indexed for humans; Zod uses 0-indexed arrays)
function formatPath(path: readonly PropertyKey[]): string {
  const parts: string[] = []
  for (let i = 0; i < path.length; i++) {
    const segment = path[i]
    const next = path[i + 1]
    if ((segment === 'questions' || segment === 'answers') && typeof next === 'number') {
      continue
    }
    if (typeof segment === 'number') {
      const parent = path[i - 1]
      if (parent === 'questions') {
        parts.push(`question ${segment + 1}`)
      } else if (parent === 'answers') {
        parts.push(`answer ${segment + 1}`)
      } else {
        parts.push(`[${segment}]`)
      }
    } else {
      parts.push(String(segment))
    }
  }
  return parts.join(', ')
}
