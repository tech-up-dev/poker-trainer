import { z } from 'zod'

// A References Library entry: cheat sheets, the Character Mapping reference, and
// methodology write-ups. Body is markdown so the client can author rich text
// without us building a bespoke editor. Rendered read-only in the member app, so
// the renderer must sanitize before injecting any HTML.
export const ReferenceSchema = z.object({
  // Optional: if the author omits it, the pipeline auto-generates a unique slug
  // from the title at save time. Non-empty when provided.
  reference_id: z.string().min(1, 'reference_id cannot be empty').optional(),
  title: z.string({ error: 'title is required' }).min(1, 'title is required'),
  // Which shelf of the library this belongs on. Optional; defaults to a general
  // bucket in the UI when absent.
  category: z
    .enum(['cheat_sheet', 'character_mapping', 'methodology'], {
      error: () => 'category must be one of: cheat_sheet, character_mapping, methodology',
    })
    .optional(),
  body_markdown: z
    .string({ error: 'body_markdown is required' })
    .min(1, 'body_markdown is required'),
  tags: z.array(z.string()).optional(),
})

export type Reference = z.infer<typeof ReferenceSchema>
