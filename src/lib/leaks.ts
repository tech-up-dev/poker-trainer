import { supabaseProd } from './supabase-prod'

export type LeakConcept = {
  concept: string       // slug
  attempts: number
  correct: number
  accuracy: number      // 0-1
  prevAccuracy: number | null  // null = no prior window data
}

// Returns the top leaking concepts for the current user, filtered and ordered
// by the get_leaks RPC. Thresholds (min attempts, accuracy ceiling) come from
// app_settings so they update live when changed in the admin screen (M3-16).
export async function fetchLeaks(): Promise<LeakConcept[]> {
  const { data, error } = await supabaseProd.rpc('get_leaks')

  if (error) throw new Error(error.message)

  return (data ?? []).map((r: Record<string, unknown>) => ({
    concept:      r.concept      as string,
    attempts:     r.attempts     as number,
    correct:      r.correct      as number,
    accuracy:     Number(r.accuracy),
    prevAccuracy: r.prev_accuracy != null ? Number(r.prev_accuracy) : null,
  }))
}
