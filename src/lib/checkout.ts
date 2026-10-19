import { supabaseProd } from './supabase-prod'

export type PricingPlan = {
  id: string
  label: string
  price: string
  period: string
  priceId: string
}

export async function createCheckoutSession(
  priceId: string,
  email?: string,
): Promise<{ url: string }> {
  const body: Record<string, string> = { price_id: priceId }
  if (email) body.email = email
  const { data, error } = await supabaseProd.functions.invoke(
    'create-checkout-session',
    { body },
  )

  if (error) {
    // Try to parse a structured error body (e.g. already_subscribed 400)
    try {
      const body = await (error as { context?: Response }).context?.json() as { code?: string; message?: string } | undefined
      if (body?.code) throw Object.assign(new Error(body.message ?? error.message), { code: body.code })
    } catch (inner) {
      if ((inner as { code?: string }).code) throw inner
    }
    throw new Error(error.message)
  }

  const result = data as { ok: boolean; url?: string; message?: string }
  if (!result.ok || !result.url) {
    throw new Error(result.message ?? 'Failed to create checkout session')
  }

  return { url: result.url }
}

export async function postPurchaseSignIn(
  sessionId: string,
): Promise<{ url: string }> {
  const { data, error } = await supabaseProd.functions.invoke(
    'post-purchase-signin',
    { body: { session_id: sessionId } },
  )

  if (error) throw new Error(error.message)

  const result = data as { ok: boolean; action_link?: string; message?: string }
  if (!result.ok || !result.action_link) {
    throw new Error(result.message ?? 'Sign-in link could not be generated')
  }

  return { url: result.action_link }
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
