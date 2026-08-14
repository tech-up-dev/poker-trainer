import { supabaseProd } from './supabase-prod'

export type Concept = { slug: string; name: string }

// The managed concept vocabulary (M3-10), for the question-tag dropdowns. Read
// against production; any authenticated user may read it (RLS). Returns [] on
// error so the wizard degrades to an empty list rather than crashing.
export async function fetchConcepts(): Promise<Concept[]> {
  const { data, error } = await supabaseProd
    .from('concepts')
    .select('slug, name')
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data as Concept[]
}
