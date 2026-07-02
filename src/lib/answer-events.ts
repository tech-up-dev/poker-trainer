import { supabaseProd } from './supabase-prod'

export type AnswerEventPayload = {
  lessonId: string
  questionId: string
  isCorrect: boolean
  selectedAnswerIndex: number
  timeTakenMs: number
}

// Append-only log of every quiz answer. Best-effort — never throws so the
// quiz flow is never blocked by a logging failure.
export async function logAnswerEvent(payload: AnswerEventPayload): Promise<void> {
  const {
    data: { user },
  } = await supabaseProd.auth.getUser()
  if (!user) return

  await supabaseProd.from('answer_events').insert({
    user_id: user.id,
    lesson_id: payload.lessonId,
    question_id: payload.questionId,
    is_correct: payload.isCorrect,
    selected_answer_index: payload.selectedAnswerIndex,
    time_taken_ms: payload.timeTakenMs,
  })
}
