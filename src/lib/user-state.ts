import { supabaseProd } from './supabase-prod'

export type BadgeSlug = 'first_lesson' | 'streak_7' | 'streak_30' | 'questions_100'

export type BadgeMeta = {
  slug: BadgeSlug
  label: string
  description: string
  icon: string
}

export const BADGE_CATALOGUE: BadgeMeta[] = [
  { slug: 'first_lesson',  label: 'First Lesson',  description: 'Complete your first lesson',     icon: '🎓' },
  { slug: 'streak_7',      label: '7-Day Streak',  description: 'Log in 7 days in a row',         icon: '🔥' },
  { slug: 'streak_30',     label: '30-Day Streak', description: 'Log in 30 days in a row',        icon: '💎' },
  { slug: 'questions_100', label: '100 Questions', description: 'Answer 100 questions total',     icon: '💯' },
]

export type UserStateRow = {
  totalPoints: number
  currentStreak: number
}

export async function fetchUserStateRow(): Promise<UserStateRow> {
  const { data } = await supabaseProd
    .from('user_streaks')
    .select('total_points, current_streak')
    .maybeSingle()
  return {
    totalPoints:   (data?.total_points   as number | null) ?? 0,
    currentStreak: (data?.current_streak as number | null) ?? 0,
  }
}

export async function fetchFreezeCount(): Promise<number> {
  const {
    data: { user },
  } = await supabaseProd.auth.getUser()
  if (!user) return 0
  const { data } = await supabaseProd
    .from('streak_freezes')
    .select('freezes_available')
    .eq('user_id', user.id)
    .maybeSingle()
  return (data?.freezes_available as number | null) ?? 0
}

export type EarnedBadge = {
  slug: BadgeSlug
  earnedAt: string
}

export async function fetchUserBadges(): Promise<EarnedBadge[]> {
  const { data } = await supabaseProd
    .from('user_badges')
    .select('badge_slug, earned_at')
  return (data ?? []).map((r) => ({
    slug: r.badge_slug as BadgeSlug,
    earnedAt: r.earned_at as string,
  }))
}
