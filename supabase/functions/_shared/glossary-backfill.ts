import { applyGlossaryLinks } from "../../../shared/utils/glossary-linking.ts";
import type { Lesson } from "../../../shared/schemas/lesson.ts";
import { stableStringify } from "../../../shared/utils/slug.ts";

export type LessonRow = { content_id: string; content: Lesson };

// Feature 2 core: recompute glossary links for every lesson against the current
// term list and return only the lessons whose content actually changed, so a
// glossary save/promote re-writes the minimum. Because it is a full recompute,
// this equally covers adding, renaming, and (once a delete flow exists) removing
// a term - the lesson simply reflects whatever terms currently exist.
export function relinkChangedLessons(rows: LessonRow[], terms: string[]): LessonRow[] {
  const changed: LessonRow[] = [];
  for (const row of rows) {
    const next = applyGlossaryLinks(row.content, terms);
    if (stableStringify(next) !== stableStringify(row.content)) {
      changed.push({ content_id: row.content_id, content: next });
    }
  }
  return changed;
}
