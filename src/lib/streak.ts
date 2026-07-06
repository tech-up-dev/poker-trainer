import { supabaseProd } from './supabase-prod'

export type StreakResult = {
  current: number  // consecutive days with at least one answer
  best: number     // longest streak ever recorded
}

// Fetches all distinct answer dates for the current user and calculates
// current and best streaks. A "day" is determined by the user's local date
// so the streak feels natural regardless of timezone.
export async function fetchStreak(): Promise<StreakResult> {
  const {
    data: { user },
  } = await supabaseProd.auth.getUser()
  if (!user) return { current: 0, best: 0 }

  const { data, error } = await supabaseProd
    .from('answer_events')
    .select('answered_at')
    .eq('user_id', user.id)
    .order('answered_at', { ascending: false })

  if (error || !data || data.length === 0) return { current: 0, best: 0 }

  // Deduplicate to one entry per local calendar day (YYYY-MM-DD).
  const days = [
    ...new Set(
      data.map((row) =>
        new Date(row.answered_at as string).toLocaleDateString('en-CA'), // YYYY-MM-DD
      ),
    ),
  ].sort((a, b) => (a > b ? -1 : 1)) // newest first

  let current = 0
  let best = 0
  let streak = 0

  const today = new Date().toLocaleDateString('en-CA')
  const yesterday = new Date(Date.now() - 864e5).toLocaleDateString('en-CA')

  // Current streak: walk backwards from today/yesterday until a gap is found.
  const startsToday = days[0] === today || days[0] === yesterday
  if (startsToday) {
    let expected = days[0]
    for (const day of days) {
      if (day === expected) {
        streak++
        const d = new Date(expected)
        d.setDate(d.getDate() - 1)
        expected = d.toLocaleDateString('en-CA')
      } else {
        break
      }
    }
    current = streak
  }

  // Best streak: scan all days sorted oldest-first.
  const asc = [...days].sort()
  let run = 1
  best = 1
  for (let i = 1; i < asc.length; i++) {
    const prev = new Date(asc[i - 1])
    const curr = new Date(asc[i])
    const diff = Math.round((curr.getTime() - prev.getTime()) / 864e5)
    if (diff === 1) {
      run++
      if (run > best) best = run
    } else {
      run = 1
    }
  }

  return { current, best: Math.max(best, current) }
}
