import { z } from 'zod'

import { LessonSchema } from './lesson.ts'
import { GlossaryEntrySchema } from './glossary.ts'
import { TipSchema } from './tip.ts'
import { ReferenceSchema } from './reference.ts'
import { PathNodeSchema } from './path-node.ts'

// Content-type registry. This is the seam the M2 pipeline generalization hangs
// off: the validate -> stage -> publish -> rollback machinery stops caring about
// "lessons" specifically and works off a content_type discriminator instead.
// Adding a new content type then means adding a schema above and a row here,
// nothing else.

export const CONTENT_TYPES = ['lesson', 'glossary', 'tip', 'reference', 'path_node'] as const

export type ContentType = (typeof CONTENT_TYPES)[number]

// Each content type knows its own Zod schema and which field holds its stable,
// author-set id. The pipeline reads idField to derive the content_id it stores a
// row under, without hard-coding "lesson_id" everywhere.
//
// labelField is the human-readable field the pipeline slugifies into a content
// id when the author omits the id. Tips have no title, so they fall back to a
// generated suffix when concept is absent too.
type ContentTypeDef = {
  schema: z.ZodTypeAny
  idField: string
  labelField?: string
}

export const contentRegistry: Record<ContentType, ContentTypeDef> = {
  lesson: { schema: LessonSchema, idField: 'lesson_id', labelField: 'title' },
  glossary: { schema: GlossaryEntrySchema, idField: 'term_id', labelField: 'term' },
  tip: { schema: TipSchema, idField: 'tip_id', labelField: 'concept' },
  reference: { schema: ReferenceSchema, idField: 'reference_id', labelField: 'title' },
  path_node: { schema: PathNodeSchema, idField: 'node_id', labelField: 'title' },
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && (CONTENT_TYPES as readonly string[]).includes(value)
}

// Pull the stable content id out of an already-validated item. Returns null if
// the id field is missing or not a string, which lets callers fail loudly rather
// than store a row under an undefined key.
export function getContentId(contentType: ContentType, item: unknown): string | null {
  if (typeof item !== 'object' || item === null) return null
  const field = contentRegistry[contentType].idField
  const value = (item as Record<string, unknown>)[field]
  return typeof value === 'string' && value.length > 0 ? value : null
}
