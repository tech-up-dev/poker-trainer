import { supabaseProd } from './supabase-prod'

export type SkillConcept = {
  slug: string
  name: string
  attempts: number
  // Member's accuracy as a 0-100 percent, or null if they have never attempted it.
  accuracy: number | null
}

export type SkillPrinciple = {
  slug: string
  name: string
  concepts: SkillConcept[]
}

type PrincipleRow = { slug: string; name: string; sort_order: number }
type ConceptRow = { slug: string; name: string; sort_order: number; principle_slug: string | null }
type AccuracyRow = { concept: string; attempts: number; accuracy: number | string }

// Build the Skills Path: the 5 Controlled Chaos principles in order, each with
// its concepts (grouped via concepts.principle_slug -> principles.slug), plus the
// signed-in member's own accuracy per concept from concept_accuracy_summary
// (owner-read RLS, so it returns only their rows and is empty for a new member).
// No lock or dependency logic: everything is unlocked day one (Steve M4 item 1).
export async function fetchSkillsPath(): Promise<SkillPrinciple[]> {
  const [principlesRes, conceptsRes, accuracyRes] = await Promise.all([
    supabaseProd
      .from('principles')
      .select('slug, name, sort_order')
      .order('sort_order', { ascending: true }),
    supabaseProd
      .from('concepts')
      .select('slug, name, sort_order, principle_slug')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabaseProd.from('concept_accuracy_summary').select('concept, attempts, accuracy'),
  ])

  const principles = (principlesRes.data ?? []) as PrincipleRow[]
  const concepts = (conceptsRes.data ?? []) as ConceptRow[]
  const accuracyByConcept = new Map<string, AccuracyRow>(
    ((accuracyRes.data ?? []) as AccuracyRow[]).map((r) => [r.concept, r]),
  )

  return principles.map((p) => ({
    slug: p.slug,
    name: p.name,
    concepts: concepts
      .filter((c) => c.principle_slug === p.slug)
      .map((c) => {
        const a = accuracyByConcept.get(c.slug)
        const attempts = a ? a.attempts : 0
        return {
          slug: c.slug,
          name: c.name,
          attempts,
          accuracy: attempts > 0 && a ? Math.round(Number(a.accuracy) * 100) : null,
        }
      }),
  }))
}
