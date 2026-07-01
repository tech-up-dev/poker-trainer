import { z } from 'zod'

// A single glossary term. One managed glossary feeds both the in-drill
// tap-to-define drawer (M1) and the browsable References Library (M2), so this
// schema has to carry everything either surface needs.
//
// related_terms holds the term_ids a definition links to. That's what powers the
// nested-linking navigation stack: tapping a linked term pushes its entry onto
// the drawer's back-stack.
export const GlossaryEntrySchema = z.object({
  // Optional: if the author omits it, the pipeline auto-generates a unique
  // slug from the term at save time. When provided it must be non-empty.
  term_id: z.string().min(1, 'term_id cannot be empty').optional(),
  term: z.string({ error: 'term is required' }).min(1, 'term is required'),
  definition: z.string({ error: 'definition is required' }).min(1, 'definition is required'),
  // How central the term is to the methodology. Drives the importance indicator
  // shown in the drawer. Optional so authors can omit it and get the default.
  importance: z
    .enum(['core', 'useful', 'situational'], {
      error: () => 'importance must be one of: core, useful, situational',
    })
    .optional(),
  // A concrete spot the term shows up at the table.
  example: z.string().optional(),
  // How it's used in a sentence / in practice.
  usage: z.string().optional(),
  // term_ids this definition links to (nested linking).
  related_terms: z.array(z.string()).optional(),
})

export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>
