import { z } from 'zod'

// A single "Today's Tip" entry. The dashboard rotates through these and members
// can save them to a personal list. Authored and versioned through the same
// pipeline as lessons (M2), so it follows the same id + tag conventions.
export const TipSchema = z.object({
  tip_id: z.string({ error: 'tip_id is required' }).min(1, 'tip_id is required'),
  body: z.string({ error: 'tip body is required' }).min(1, 'tip body is required'),
  // Same tag vocabulary as lessons so a tip can be tied back to a principle or
  // concept for filtering and future recommendations. Both optional: a tip
  // doesn't have to map to one.
  principle_tag: z.string().optional(),
  concept: z.string().optional(),
  tags: z.array(z.string()).optional(),
})

export type Tip = z.infer<typeof TipSchema>
