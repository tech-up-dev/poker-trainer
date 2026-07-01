import type { Tip } from '../../shared/schemas/tip'
import { supabaseProd } from './supabase-prod'

export async function fetchAllPublishedTips(): Promise<Tip[]> {
  const { data, error } = await supabaseProd
    .from('content_published')
    .select('content')
    .eq('content_type', 'tip')
    .order('content_id')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.content as Tip)
}

// Returns a deterministic tip for today: stable within a calendar day,
// rotating across the full tip library. Falls back to the first tip if
// the library has only one entry, and to null if the library is empty.
export async function fetchTodaysTip(): Promise<Tip | null> {
  const tips = await fetchAllPublishedTips()
  if (tips.length === 0) return null
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
  )
  return tips[dayOfYear % tips.length]
}
