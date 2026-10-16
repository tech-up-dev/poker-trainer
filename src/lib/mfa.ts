import { supabaseProd } from './supabase-prod'

export type MfaStatus = {
  // True when the account has an enrolled (verified) authenticator app.
  hasVerifiedTotp: boolean
  // True when the account has one but this session has not entered a code yet.
  needsChallenge: boolean
}

export async function getMfaStatus(): Promise<MfaStatus> {
  const [aal, factors] = await Promise.all([
    supabaseProd.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabaseProd.auth.mfa.listFactors(),
  ])
  if (aal.error || factors.error) throw new Error((aal.error ?? factors.error)!.message)
  return {
    hasVerifiedTotp: factors.data.totp.length > 0,
    needsChallenge: aal.data.currentLevel === 'aal1' && aal.data.nextLevel === 'aal2',
  }
}
