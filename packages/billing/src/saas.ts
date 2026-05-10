import Stripe from 'stripe'
import type { BillingResult } from './types'

function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY não configurada')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
}

export async function createSaaSSubscription(params: {
  customerId: string
  priceId: string
  quantity?: number
  trialDays?: number
  metadata?: Record<string, string>
}): Promise<BillingResult<{ subscriptionId: string; status: string }>> {
  try {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: params.priceId, quantity: params.quantity ?? 1 }],
      trial_period_days: params.trialDays,
      metadata: params.metadata ?? {},
    })
    return { data: { subscriptionId: subscription.id, status: subscription.status }, error: null }
  } catch (err) {
    return { data: null, error: (err as Error).message }
  }
}

export async function updateSubscriptionQuantity(params: {
  subscriptionId: string
  quantity: number
}): Promise<BillingResult> {
  try {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(params.subscriptionId)
    const itemId = subscription.items.data[0]?.id
    if (!itemId) return { data: null, error: 'Subscription has no items' }
    await stripe.subscriptions.update(params.subscriptionId, {
      items: [{ id: itemId, quantity: params.quantity }],
    })
    return { data: null, error: null }
  } catch (err) {
    return { data: null, error: (err as Error).message }
  }
}

export async function isSubscriptionActive(subscriptionId: string): Promise<boolean> {
  try {
    const stripe = getStripe()
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return subscription.status === 'active' || subscription.status === 'trialing'
  } catch {
    return false
  }
}
