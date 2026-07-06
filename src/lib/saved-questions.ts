import { supabaseProd } from './supabase-prod'

export type SavedQuestionRef = {
  contentId: string
  questionId: string
}

export async function saveQuestion(contentId: string, questionId: string): Promise<void> {
  const { error } = await supabaseProd
    .from('user_saved_questions')
    .upsert({ content_id: contentId, question_id: questionId }, { onConflict: 'user_id,content_id,question_id' })
  if (error) throw new Error(error.message)
}

export async function unsaveQuestion(contentId: string, questionId: string): Promise<void> {
  const { error } = await supabaseProd
    .from('user_saved_questions')
    .delete()
    .eq('content_id', contentId)
    .eq('question_id', questionId)
  if (error) throw new Error(error.message)
}

export async function fetchSavedQuestionRefs(): Promise<SavedQuestionRef[]> {
  const { data, error } = await supabaseProd
    .from('user_saved_questions')
    .select('content_id, question_id')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    contentId: row.content_id as string,
    questionId: row.question_id as string,
  }))
}
