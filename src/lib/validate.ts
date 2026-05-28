import { LessonSchema, type Lesson } from "../../shared/schemas/lesson";

export type FieldError = { path: string; message: string };

export type ValidationResult =
  | { ok: true; data: Lesson }
  | { ok: false; errors: FieldError[] };

export function validateLesson(input: unknown): ValidationResult {
  const result = LessonSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const errors: FieldError[] = result.error.issues.map((issue) => ({
    path: formatPath(issue.path),
    message: issue.message,
  }));
  return { ok: false, errors };
}

// Convert Zod paths like ["questions", 2, "answers"] into "question 3, answers"
// (1-indexed for humans; Zod uses 0-indexed arrays)
function formatPath(path: readonly PropertyKey[]): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const segment = path[i];
    const next = path[i + 1];
    if (
      (segment === "questions" || segment === "answers") &&
      typeof next === "number"
    ) {
      continue;
    }
    if (typeof segment === "number") {
      const parent = path[i - 1];
      if (parent === "questions") {
        parts.push(`question ${segment + 1}`);
      } else if (parent === "answers") {
        parts.push(`answer ${segment + 1}`);
      } else {
        parts.push(`[${segment}]`);
      }
    } else {
      parts.push(String(segment));
    }
  }
  return parts.join(", ");
}
