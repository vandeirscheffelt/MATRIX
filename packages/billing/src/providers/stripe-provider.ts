import type { IPaymentGateway, GatewayCheckoutParams, GatewayPortalParams, GatewayCheckoutResult } from '../gateway-interface'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY não configurada')
  const Stripe = require('stripe')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
}

export class StripeProvider implements IPaymentGateway {
  async createCheckout(params: GatewayCheckoutParams): Promise<GatewayCheckoutResult> {
    const priceId = process.env.STRIPE_PRICE_SHAIKRON_BASE
    if (!priceId) throw new Error('STRIPE_PRICE_SHAIKRON_BASE não configurada')

    const stripe = getStripe()

    const existing = await stripe.customers.list({ email: params.userEmail, limit: 1 })
    let customerId: string
    if (existing.data.length > 0) {
      customerId = existing.data[0].id
    } else {
      const customer = await stripe.customers.create({
        email: params.userEmail,
        metadata: { userId: params.userId },
      })
      customerId = customer.id
    }

    const lineItems: object[] = [{ price: priceId, quantity: 1 }]

    const priceExtra = process.env.STRIPE_PRICE_SHAIKRON_USUARIO_EXTRA
    if (priceExtra && (params.usuariosExtras ?? 0) > 0) {
      lineItems.push({ price: priceExtra, quantity: params.usuariosExtras })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      subscription_data: {
        trial_period_days: params.trialDays,
        metadata: { empresaId: params.empresaId },
      },
      metadata: { empresaId: params.empresaId },
    })

    return {
      url: session.url!,
      gateway: 'stripe',
      customerId,
      subscriptionId: undefined,
    }
  }

  async createPortalSession(params: GatewayPortalParams): Promise<{ url: string }> {
    const stripe = getStripe()
    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    })
    return { url: session.url }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const stripe = getStripe()
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
  }
}
