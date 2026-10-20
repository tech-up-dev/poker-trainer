import { useEffect, useState } from 'react'

import { supabaseProd } from './supabase-prod'
import type { PricingPlan } from './checkout'

type PriceRow = { price_id: string; amount: number; interval: 'month' | 'year' }

// Plans come from the admin-managed stripe_prices table (readable by logged-out
// visitors), so switching to the live Stripe prices is a database change only.
// Shows the first enabled price of each interval, monthly first.
export async function fetchPricingPlans(): Promise<PricingPlan[]> {
  const { data, error } = await supabaseProd
    .from('stripe_prices')
    .select('price_id, amount, interval')
    .eq('enabled', true)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as PriceRow[]
  const monthly = rows.find((r) => r.interval === 'month')
  const annual = rows.find((r) => r.interval === 'year')
  const plans: PricingPlan[] = []
  if (monthly) {
    plans.push({ id: 'monthly', label: 'Monthly', price: `$${monthly.amount}`, period: 'per month', priceId: monthly.price_id })
  }
  if (annual) {
    plans.push({ id: 'annual', label: 'Annual', price: `$${annual.amount}`, period: 'per year', priceId: annual.price_id })
  }
  return plans
}

export function usePricingPlans(): { plans: PricingPlan[]; loading: boolean } {
  const [plans, setPlans] = useState<PricingPlan[] | null>(null)

  useEffect(() => {
    fetchPricingPlans()
      .then(setPlans)
      .catch(() => setPlans([]))
  }, [])

  return { plans: plans ?? [], loading: plans === null }
}
