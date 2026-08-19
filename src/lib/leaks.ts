import { supabaseProd } from './supabase-prod'

// A concept the member is "leaking" on: enough attempts, low enough accuracy.
// accuracy / prevAccuracy are 0..1 fractions (multiply by 100 for a percent).
export type LeakConcept = {
  concept: string
  attempts: number
  correct: number
  accuracy: number
  prevAccuracy: number | null
}

type LeakRow = {
  concept: string
  attempts: number
  correct: number
  accuracy: number | string
  prev_accuracy: number | string | null
}

// Fetch the signed-in member's leak concepts. First recompute the rolling-window
// accuracy summary, then read the leaks through the get_leaks RPC, which applies
// the admin-configurable leak_min_attempts / leak_accuracy_ceiling thresholds
// from app_settings at query time (M3-16) and returns worst-first.
export async function fetchLeaks(): Promise<LeakConcept[]> {
  await supabaseProd.rpc('refresh_concept_accuracy')
  const { data, error } = await supabaseProd.rpc('get_leaks')
  if (error) throw new Error(error.message)
  return ((data ?? []) as LeakRow[]).map((r) => ({
    concept: r.concept,
    attempts: r.attempts,
    correct: r.correct,
    accuracy: Number(r.accuracy),
    prevAccuracy: r.prev_accuracy != null ? Number(r.prev_accuracy) : null,
  }))
}
