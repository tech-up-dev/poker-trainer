import { supabaseProd } from './supabase-prod'

export type ActivitySummary = {
  weeklyActiveDays: number   // distinct days with activity in the current ISO week (Mon-Sun)
  monthlyActiveDays: number  // distinct days with activity in the current calendar month
}

export const WEEKLY_GOAL_DAYS  = 5   // target active days per week
export const MONTHLY_GOAL_DAYS = 20  // target active days per month (qualification threshold)

export async function fetchActivitySummary(): Promise<ActivitySummary> {
  const {
    data: { user },
  } = await supabaseProd.auth.getUser()
  if (!user) return { weeklyActiveDays: 0, monthlyActiveDays: 0 }

  const now = new Date()

  // Calendar month window
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  // ISO week window: Mon–Sun
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1  // 0=Mon … 6=Sun
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dayOfWeek)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const { data, error } = await supabaseProd
    .from('answer_events')
    .select('answered_at')
    .eq('user_id', user.id)
    .gte('answered_at', monthStart)
    .lte('answered_at', monthEnd)

  if (error || !data) return { weeklyActiveDays: 0, monthlyActiveDays: 0 }

  const toDay = (iso: string) =>
    new Date(iso).toLocaleDateString('en-CA') // YYYY-MM-DD

  const monthDays = new Set(data.map((r) => toDay(r.answered_at as string)))
  const weekDays  = new Set(
    data
      .filter((r) => {
        const d = new Date(r.answered_at as string)
        return d >= weekStart && d <= weekEnd
      })
      .map((r) => toDay(r.answered_at as string)),
  )

  return {
    weeklyActiveDays:  weekDays.size,
    monthlyActiveDays: monthDays.size,
  }
}
