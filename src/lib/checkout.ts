import { supabaseProd } from './supabase-prod'

export type PricingPlan = {
  id: string
  label: string
  price: string
  period: string
  priceId: string
}

// Placeholder price IDs — swap for real Stripe price IDs once credentials are available.
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$27',
    period: 'per month',
    priceId: 'price_PLACEHOLDER_MONTHLY',
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '$47',
    period: 'per month',
    priceId: 'price_PLACEHOLDER_PRO',
  },
]

export async function createCheckoutSession(
  priceId: string,
): Promise<{ url: string }> {
  const { data, error } = await supabaseProd.functions.invoke(
    'create-checkout-session',
    { body: { price_id: priceId } },
  )

  if (error) throw new Error(error.message)

  const result = data as { ok: boolean; url?: string; message?: string }
  if (!result.ok || !result.url) {
    throw new Error(result.message ?? 'Failed to create checkout session')
  }

  return { url: result.url }
}

// Polls user_entitlements until the Stripe webhook has written the row.
// Resolves true when entitlement is found, false after timeout.
export async function pollForEntitlement(
  userId: string,
  maxWaitMs = 15000,
  intervalMs = 2000,
): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    const { data } = await supabaseProd
      .from('entitlements')
      .select('status')
      .eq('user_id', userId)
      .eq('entitlement_key', 'quiz_app_access')
      .eq('status', 'active')
      .maybeSingle()

    if (data) return true

    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return false
}
