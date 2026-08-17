import { supabaseProd } from './supabase-prod'

export type UserBadge = {
  slug: string
  earnedAt: string
}

// Badge catalogue — all milestone badges the app can award.
// slug matches what BE writes to user_badges.badge_slug.
export const BADGE_CATALOGUE: {
  slug: string
  name: string
  description: string
  emoji: string
}[] = [
  { slug: 'first_lesson',  name: 'First Lesson',   description: 'Completed your first lesson',        emoji: '🎓' },
  { slug: 'streak_7',      name: '7-Day Streak',    description: 'Kept a 7-day training streak',       emoji: '🔥' },
  { slug: 'streak_30',     name: '30-Day Streak',   description: 'Kept a 30-day training streak',      emoji: '💎' },
  { slug: 'questions_100', name: '100 Questions',   description: 'Answered 100 questions total',       emoji: '💯' },
]

// Reads the fast-read state row from user_streaks.
// Returns null when the row doesn't exist yet (BE award logic not run yet).
export async function fetchUserStateRow(): Promise<{
  totalPoints: number
} | null> {
  const { data: { user } } = await supabaseProd.auth.getUser()
  if (!user) return null

  const { data, error } = await supabaseProd
    .from('user_streaks')
    .select('total_points')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !data) return null
  return { totalPoints: (data.total_points as number) ?? 0 }
}

// Reads all earned badges for the current user.
export async function fetchUserBadges(): Promise<UserBadge[]> {
  const { data: { user } } = await supabaseProd.auth.getUser()
  if (!user) return []

  const { data, error } = await supabaseProd
    .from('user_badges')
    .select('badge_slug, earned_at')
    .eq('user_id', user.id)
    .order('earned_at', { ascending: true })

  if (error || !data) return []
  return data.map((r) => ({
    slug: r.badge_slug as string,
    earnedAt: r.earned_at as string,
  }))
}
