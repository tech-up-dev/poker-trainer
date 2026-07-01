import type { Reference } from '../../shared/schemas/reference'
import { supabaseProd } from './supabase-prod'

export async function fetchAllPublishedReferences(): Promise<Reference[]> {
  const { data, error } = await supabaseProd
    .from('content_published')
    .select('content')
    .eq('content_type', 'reference')
    .order('content_id')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.content as Reference)
}
