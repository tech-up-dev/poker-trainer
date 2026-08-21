import { supabaseProd } from './supabase-prod'

export type ActivitySummary = {
  weeklyActiveDays: number
  monthlyActiveDays: number
  weeklyGoalDays: number
  monthlyGoalDays: number
}

// Qualifying day = any calendar day on which the member completed at least one
// lesson or drill. Matches the BE cron definition so the counts stay in sync.
export async function fetchActivitySummary(): Promise<ActivitySummary> {
  const {
    data: { user },
  } = await supabaseProd.auth.getUser()
  if (!user) return { weeklyActiveDays: 0, monthlyActiveDays: 0, weeklyGoalDays: 5, monthlyGoalDays: 20 }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // ISO week: Mon=0 … Sun=6
  const dowIso = now.getDay() === 0 ? 6 : now.getDay() - 1
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - dowIso)
  weekStart.setHours(0, 0, 0, 0)

  const [progressResult, settingsResult] = await Promise.all([
    supabaseProd
      .from('user_progress')
      .select('last_attempted_at')
      .eq('user_id', user.id)
      .eq('completed', true)
      .gte('last_attempted_at', monthStart),
    supabaseProd
      .from('app_settings')
      .select('key, value')
      .in('key', ['weekly_goal_days', 'monthly_goal_days']),
  ])

  const toDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA') // YYYY-MM-DD
  const completions = progressResult.data ?? []

  const monthDays = new Set(completions.map((r) => toDay(r.last_attempted_at as string)))
  const weekDays = new Set(
    completions
      .filter((r) => new Date(r.last_attempted_at as string) >= weekStart)
      .map((r) => toDay(r.last_attempted_at as string)),
  )

  const settings = settingsResult.data ?? []
  const getSetting = (key: string, def: number): number => {
    const row = settings.find((s) => s.key === key)
    return row ? Number(row.value ?? def) : def
  }

  return {
    weeklyActiveDays:  weekDays.size,
    monthlyActiveDays: monthDays.size,
    weeklyGoalDays:    getSetting('weekly_goal_days',  5),
    monthlyGoalDays:   getSetting('monthly_goal_days', 20),
  }
}
