import type { Lesson } from '../../shared/schemas/lesson'
import { supabaseProd } from './supabase-prod'

export async function fetchPublishedLesson(
  lessonId: string,
): Promise<Lesson | null> {
  const { data, error } = await supabaseProd
    .from('content_published')
    .select('content')
    .eq('content_id', lessonId)
    .eq('content_type', 'lesson')
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (data === null) return null
  return data.content as Lesson
}
