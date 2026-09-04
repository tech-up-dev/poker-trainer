import { supabaseProd } from './supabase-prod'

export type UpsellButtonConfig = {
  title: string
  subtitle: string
  enabled: boolean
  member_banner: string
  non_member_banner: string
  non_member_cta: string
  page_eyebrow: string
  page_title: string
  page_subtitle: string
}

export const DEFAULT_UPSELL_CONFIG: UpsellButtonConfig = {
  title: 'Unlock Pro Training',
  subtitle: 'Members save 40%',
  enabled: true,
  member_banner: 'Your active membership unlocks 40% off every course below - the member price is already applied, no code needed.',
  non_member_banner: 'Members save 40% on every course below',
  non_member_cta: 'subscribe to unlock member pricing',
  page_eyebrow: 'Pro Training',
  page_title: 'Take your game to the next level',
  page_subtitle: "Advanced courses hand-picked to build on what you're learning here - each one goes deeper than the core trainer.",
}

export async function fetchUpsellButtonConfig(): Promise<UpsellButtonConfig> {
  const { data } = await supabaseProd
    .from('app_settings')
    .select('value')
    .eq('key', 'unlock_pro_training_button')
    .single()
  if (data?.value && typeof data.value === 'object') {
    return { ...DEFAULT_UPSELL_CONFIG, ...(data.value as Partial<UpsellButtonConfig>) }
  }
  return DEFAULT_UPSELL_CONFIG
}
