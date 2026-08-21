import { supabaseProd } from './supabase-prod'

export type PricingPlan = {
  id: string
  label: string
  price: string
  period: string
  priceId: string
}

// Stripe price catalog (sandbox). One product (prod_V62YK0fB9siL8E); every price
// grants the SAME quiz_app_access. There is no feature-differentiated tier, so
// never gate anything on which price was paid. The amounts are just different
// price points; which subset the UI offers is a product choice.
export const STRIPE_PRICES = {
  monthly: [
    { amount: 37, priceId: 'price_1U5qTE014e1UrpFzAkmbcCd7' },
    { amount: 47, priceId: 'price_1U5qTE014e1UrpFzTppaHhYg' },
    { amount: 57, priceId: 'price_1U5qTE014e1UrpFz5riTevmd' },
    { amount: 67, priceId: 'price_1U5qTE014e1UrpFzjXiYhpzH' },
  ],
  annual: [
    { amount: 397, priceId: 'price_1U5qTE014e1UrpFz0s8ps3zo' },
    { amount: 497, priceId: 'price_1U5qTE014e1UrpFzEG6CVuXJ' },
    { amount: 597, priceId: 'price_1U5qTE014e1UrpFzCZWKmxrm' },
    { amount: 697, priceId: 'price_1U5qTE014e1UrpFzZEsCce0j' },
  ],
} as const

// Default plans shown at checkout: one monthly, one annual. All prices in
// STRIPE_PRICES grant identical access, so swapping these ids for a different
// price point needs no other change.
export const PRICING_PLANS: PricingPlan[] = [
  { id: 'monthly', label: 'Monthly', price: '$37', period: 'per month', priceId: STRIPE_PRICES.monthly[0].priceId },
  { id: 'annual', label: 'Annual', price: '$397', period: 'per year', priceId: STRIPE_PRICES.annual[0].priceId },
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

// Polls entitlements until a grant has written the active row (the stripe-webhook
// on the in-app path, or the GHL sync on the tag path).
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
