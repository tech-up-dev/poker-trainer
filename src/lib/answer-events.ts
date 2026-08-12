import { supabaseProd } from './supabase-prod'

export type AnswerEventPayload = {
  lessonId: string
  questionId: string
  isCorrect: boolean
  selectedAnswerIndex: number
  timeTakenMs: number
  // Question tags snapshotted onto the event at answer time (M3-08). Optional
  // because existing content may not carry them yet. Stored as copied values so
  // re-tagging the question later never changes this historical row.
  concept?: string
  street?: string
  playerType?: string
  difficulty?: string
}

// The delivery surface the answer was given on. Installed PWA vs plain browser is
// the distinction that matters for this app; extend if finer detail is needed.
function detectPlatform(): string {
  if (typeof window === 'undefined') return 'unknown'
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (window.navigator as { standalone?: boolean }).standalone === true
  return standalone ? 'pwa' : 'web'
}

// Append-only log of every quiz answer. Best-effort: never throws so the quiz
// flow is never blocked by a logging failure.
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
    concept: payload.concept ?? null,
    street: payload.street ?? null,
    player_type: payload.playerType ?? null,
    difficulty: payload.difficulty ?? null,
    platform: detectPlatform(),
  })
}
