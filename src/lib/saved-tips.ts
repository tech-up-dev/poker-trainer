import { supabaseProd } from './supabase-prod'

export async function saveTip(tipId: string): Promise<void> {
  const { error } = await supabaseProd
    .from('user_saved_tips')
    .upsert({ tip_id: tipId }, { onConflict: 'user_id,tip_id' })
  if (error) throw new Error(error.message)
}

export async function unsaveTip(tipId: string): Promise<void> {
  const { error } = await supabaseProd
    .from('user_saved_tips')
    .delete()
    .eq('tip_id', tipId)
  if (error) throw new Error(error.message)
}

export async function fetchSavedTipIds(): Promise<string[]> {
  const { data, error } = await supabaseProd
    .from('user_saved_tips')
    .select('tip_id')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => row.tip_id as string)
}
