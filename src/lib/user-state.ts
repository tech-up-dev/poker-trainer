import { supabaseProd } from './supabase-prod'

export type BadgeSlug = 'first_lesson' | 'streak_7' | 'streak_30' | 'questions_100'

export type BadgeMeta = {
  slug: BadgeSlug
  name: string
  label: string
  description: string
  emoji: string
  icon: string
}

export const BADGE_CATALOGUE: BadgeMeta[] = [
  { slug: 'first_lesson',  name: 'First Lesson',  label: 'First Lesson',  description: 'Complete your first lesson',   emoji: '🎓', icon: '🎓' },
  { slug: 'streak_7',      name: '7-Day Streak',  label: '7-Day Streak',  description: 'Log in 7 days in a row',       emoji: '🔥', icon: '🔥' },
  { slug: 'streak_30',     name: '30-Day Streak', label: '30-Day Streak', description: 'Log in 30 days in a row',      emoji: '💎', icon: '💎' },
  { slug: 'questions_100', name: '100 Questions', label: '100 Questions', description: 'Answer 100 questions total',   emoji: '💯', icon: '💯' },
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
  const { data: { user } } = await supabaseProd.auth.getUser()
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

export type UserBadge = EarnedBadge

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
    slug: r.badge_slug as BadgeSlug,
    earnedAt: r.earned_at as string,
  }))
}
