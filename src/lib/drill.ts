import type { Question } from '../../shared/schemas/lesson'
import { supabaseProd } from './supabase-prod'
import { fetchLeaks } from './leaks'
import { fetchAllPublishedLessons } from './lessons'

export type DrillQuestion = Question & {
  lessonId: string
  conceptSlug: string
}

// Returns up to 10 drill questions weighted 4/3/3 across the top 3 weak concepts.
// Priority within each concept: recent misses first, then unseen questions.
// Excludes any question answered in the last 7 days.
export async function buildDrill(): Promise<DrillQuestion[]> {
  const [leaks, allLessons, user] = await Promise.all([
    fetchLeaks(),
    fetchAllPublishedLessons(),
    supabaseProd.auth.getUser(),
  ])

  if (leaks.length === 0 || !user.data.user) return []

  const userId = user.data.user.id
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch question IDs answered in last 7 days (to exclude)
  const { data: recentRows } = await supabaseProd
    .from('answer_events')
    .select('question_id')
    .eq('user_id', userId)
    .gte('answered_at', sevenDaysAgo)

  const recentlySeenIds = new Set((recentRows ?? []).map((r) => r.question_id as string))

  // Fetch recent incorrect question IDs per concept (for priority ordering)
  const { data: missRows } = await supabaseProd
    .from('answer_events')
    .select('question_id, concept, answered_at')
    .eq('user_id', userId)
    .eq('is_correct', false)
    .in('concept', leaks.map((l) => l.concept))
    .order('answered_at', { ascending: false })

  // Map concept slug -> ordered list of missed question IDs (most recent first)
  const missMap: Record<string, string[]> = {}
  for (const row of missRows ?? []) {
    const concept = row.concept as string
    const qId = row.question_id as string
    if (!missMap[concept]) missMap[concept] = []
    missMap[concept].push(qId)
  }

  // Build a pool of available questions per concept
  // Index questions from all lessons by concept slug, excluding recently seen
  const poolByConceptSlug: Record<string, DrillQuestion[]> = {}
  for (const lesson of allLessons) {
    if (!lesson.lesson_id) continue
    for (const q of lesson.questions) {
      const conceptSlug = q.concept ?? lesson.concept
      if (!conceptSlug) continue
      if (recentlySeenIds.has(q.question_id)) continue
      if (!poolByConceptSlug[conceptSlug]) poolByConceptSlug[conceptSlug] = []
      poolByConceptSlug[conceptSlug].push({ ...q, lessonId: lesson.lesson_id, conceptSlug })
    }
  }

  // Sort each concept pool: missed questions first (most recent miss first), then unseen
  for (const conceptSlug of Object.keys(poolByConceptSlug)) {
    const missOrder = missMap[conceptSlug] ?? []
    const missRank = new Map(missOrder.map((id, i) => [id, i]))
    poolByConceptSlug[conceptSlug].sort((a, b) => {
      const ra = missRank.has(a.question_id) ? missRank.get(a.question_id)! : Infinity
      const rb = missRank.has(b.question_id) ? missRank.get(b.question_id)! : Infinity
      return ra - rb
    })
  }

  // Allocate 4/3/3 across up to 3 concepts, backfilling from the next when short
  const targets = [4, 3, 3].slice(0, leaks.length)
  const conceptSlugs = leaks.map((l) => l.concept)
  const selected: DrillQuestion[] = []

  let remainder = 0
  for (let i = 0; i < conceptSlugs.length; i++) {
    const slug = conceptSlugs[i]
    const pool = poolByConceptSlug[slug] ?? []
    const want = targets[i] + remainder
    const take = pool.slice(0, want)
    selected.push(...take)
    remainder = want - take.length
  }

  // If still short after all concepts, backfill from any remaining pool entries
  if (remainder > 0) {
    for (const slug of conceptSlugs) {
      const pool = poolByConceptSlug[slug] ?? []
      const alreadyTaken = selected.filter((q) => q.conceptSlug === slug).length
      const extras = pool.slice(alreadyTaken, alreadyTaken + remainder)
      selected.push(...extras)
      remainder -= extras.length
      if (remainder <= 0) break
    }
  }

  return selected.slice(0, 10)
}
