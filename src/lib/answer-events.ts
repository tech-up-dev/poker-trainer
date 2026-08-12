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
  conceptTag?: string
  principleTag?: string
  street?: string
  playerType?: string
  difficulty?: string
  platform?: string
}

function detectPlatform(): string {
  if (typeof window === 'undefined') return 'unknown'
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return 'pwa-ios'
  if (window.matchMedia('(display-mode: standalone)').matches) return 'pwa'
  if (/Mobi|Android/i.test(navigator.userAgent)) return 'mobile-web'
  return 'web'
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
    // DB column is `concept` (M3-08 migration); principleTag has no column yet.
    concept: payload.conceptTag ?? null,
    street: payload.street ?? null,
    player_type: payload.playerType ?? null,
    difficulty: payload.difficulty ?? null,
    platform: payload.platform ?? detectPlatform(),
  })
}
