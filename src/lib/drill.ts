import type { Question } from '../../shared/schemas/lesson'
import { fetchLeaks } from './leaks'
import { fetchAllPublishedLessons } from './lessons'
import { supabaseProd } from './supabase-prod'

export type DrillQuestion = Question & {
  lessonId: string
  conceptSlug: string
}

const DRILL_SIZE = 10
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function buildDrill(): Promise<DrillQuestion[]> {
  const [leaks, allLessons] = await Promise.all([fetchLeaks(), fetchAllPublishedLessons()])

  if (leaks.length === 0) return []

  const {
    data: { user },
  } = await supabaseProd.auth.getUser()

  const recentCutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

  const [recentResult, missResult] = await Promise.all([
    user
      ? supabaseProd
          .from('answer_events')
          .select('question_id')
          .eq('user_id', user.id)
          .gte('answered_at', recentCutoff)
      : Promise.resolve({ data: [] }),
    user
      ? supabaseProd
          .from('answer_events')
          .select('question_id')
          .eq('user_id', user.id)
          .eq('is_correct', false)
          .order('answered_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
  ])

  const excludedIds = new Set(
    ((recentResult as { data: { question_id: string }[] | null }).data ?? []).map(
      (r) => r.question_id,
    ),
  )

  const missRankMap = new Map<string, number>()
  ;((missResult as { data: { question_id: string }[] | null }).data ?? []).forEach((r, i) => {
    if (!missRankMap.has(r.question_id)) missRankMap.set(r.question_id, i)
  })

  // Build concept -> questions map from all lessons
  const conceptMap = new Map<string, DrillQuestion[]>()
  for (const lesson of allLessons) {
    if (!lesson.lesson_id) continue
    for (const q of lesson.questions) {
      const concept = q.concept ?? lesson.concept
      if (!concept) continue
      if (!conceptMap.has(concept)) conceptMap.set(concept, [])
      conceptMap.get(concept)!.push({ ...q, lessonId: lesson.lesson_id, conceptSlug: concept })
    }
  }

  // 4/3/3 allocation across top 3 leak concepts
  const topLeaks = leaks.slice(0, 3)
  const allocations = [4, 3, 3].slice(0, topLeaks.length)

  const result: DrillQuestion[] = []
  let remainder = 0

  for (let i = 0; i < topLeaks.length; i++) {
    const concept = topLeaks[i].concept
    const want = allocations[i] + remainder

    const pool = (conceptMap.get(concept) ?? [])
      .filter((q) => !excludedIds.has(q.question_id))
      .sort((a, b) => {
        const ra = missRankMap.get(a.question_id) ?? Infinity
        const rb = missRankMap.get(b.question_id) ?? Infinity
        return ra - rb
      })

    const pick = pool.slice(0, want)
    result.push(...pick)
    remainder = want - pick.length
  }

  // Backfill with unseen questions if we're short
  if (result.length < DRILL_SIZE) {
    const pickedIds = new Set(result.map((q) => q.question_id))
    outer: for (const lesson of allLessons) {
      if (!lesson.lesson_id) continue
      for (const q of lesson.questions) {
        if (pickedIds.has(q.question_id) || excludedIds.has(q.question_id)) continue
        const concept = q.concept ?? lesson.concept
        result.push({ ...q, lessonId: lesson.lesson_id, conceptSlug: concept })
        pickedIds.add(q.question_id)
        if (result.length >= DRILL_SIZE) break outer
      }
    }
  }

  return result.slice(0, DRILL_SIZE)
}
