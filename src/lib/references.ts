import type { Reference } from '../../shared/schemas/reference'
import { supabaseProd } from './supabase-prod'

export async function fetchAllPublishedReferences(): Promise<Reference[]> {
  const { data, error } = await supabaseProd
    .from('content_published')
    .select('content')
    .eq('content_type', 'reference')
    .order('content_id')
  if (error) throw new Error(error.message)
  const refs = (data ?? []).map((row) => row.content as Reference)
  // Array.sort is stable, so ties and unnumbered items keep the content_id order from the query.
  return refs.sort((a, b) => (a.sort_order ?? Number.MAX_SAFE_INTEGER) - (b.sort_order ?? Number.MAX_SAFE_INTEGER))
}
