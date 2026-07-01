import { supabaseProd } from './supabase-prod'

export type ProgressPayload = {
  lessonId: string
  questionsAnswered: number
  questionsCorrect: number
  completed: boolean
}

export type LessonProgress = {
  lessonId: string
  questionsCorrect: number
  questionsAnswered: number
  completed: boolean
}

export async function fetchLessonProgress(): Promise<LessonProgress[]> {
  const { data, error } = await supabaseProd
    .from('user_progress')
    .select('content_id, questions_correct, questions_answered, completed')
    .eq('content_type', 'lesson')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    lessonId: row.content_id as string,
    questionsCorrect: row.questions_correct as number,
    questionsAnswered: row.questions_answered as number,
    completed: row.completed as boolean,
  }))
}

export async function upsertProgress(payload: ProgressPayload): Promise<void> {
  const { error } = await supabaseProd.from('user_progress').upsert(
    {
      content_id: payload.lessonId,
      content_type: 'lesson',
      questions_answered: payload.questionsAnswered,
      questions_correct: payload.questionsCorrect,
      completed: payload.completed,
      last_attempted_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,content_id,content_type' },
  )
  if (error) throw new Error(error.message)
}
