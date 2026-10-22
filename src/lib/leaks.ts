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
// Recompute the saved per-concept accuracy summary from the latest answers. The
// Stats and Lessons pages read that summary, so they call this first; otherwise the
// scores stay stale until the member happens to open Home. Never throws: a failed
// refresh just means the previous scores are shown.
export async function refreshConceptAccuracy(): Promise<void> {
  try {
    await supabaseProd.rpc('refresh_concept_accuracy')
  } catch { /* keep showing the previous scores */ }
}

// True once the member has at least one concept with enough answers to be scored.
// Callers refresh the summary first (fetchLeaks does), so this only reads it.
export async function fetchHasScoredConcept(): Promise<boolean> {
  const { data, error } = await supabaseProd.rpc('get_all_concept_scores')
  if (error) throw new Error(error.message)
  return ((data ?? []) as { concept: string; band: string }[])
    .some((s) => s.concept !== 'test' && s.band !== 'not_enough')
}

export async function fetchLeaks(): Promise<LeakConcept[]> {
  await refreshConceptAccuracy()
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
