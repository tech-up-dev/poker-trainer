import { supabaseProd } from './supabase-prod'

export const REFERENCE_CATEGORY_LABEL: Record<string, string> = {
  cheat_sheet:       'Cheat Sheets',
  character_mapping: 'Character Mapping',
  methodology:       'Methodology',
}

export const DEFAULT_REFERENCE_CATEGORY_ORDER = ['cheat_sheet', 'character_mapping', 'methodology']

const SETTING_KEY = 'reference_category_order'

// Keep only known sections and append any the saved list is missing, so a stale
// or partial setting can never hide a section.
function normalize(saved: unknown): string[] {
  const list = Array.isArray(saved) ? saved.filter((k): k is string => typeof k === 'string') : []
  const known = list.filter((k) => DEFAULT_REFERENCE_CATEGORY_ORDER.includes(k))
  const unique = [...new Set(known)]
  return [...unique, ...DEFAULT_REFERENCE_CATEGORY_ORDER.filter((k) => !unique.includes(k))]
}

export async function fetchReferenceCategoryOrder(): Promise<string[]> {
  const { data } = await supabaseProd.from('app_settings').select('value').eq('key', SETTING_KEY).maybeSingle()
  return normalize(data?.value)
}

export async function saveReferenceCategoryOrder(order: string[]): Promise<void> {
  const { data, error } = await supabaseProd
    .from('app_settings')
    .update({ value: order })
    .eq('key', SETTING_KEY)
    .select('key')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error('The section order setting does not exist yet. Ask the back-end developer to add it.')
  }
}
