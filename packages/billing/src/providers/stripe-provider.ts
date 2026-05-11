import type { IPaymentGateway, GatewayCheckoutParams, GatewayPortalParams, GatewayCheckoutResult } from '../gateway-interface'
import Stripe from 'stripe'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY não configurada')
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' as any })
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

    let promotionCodeId: string | undefined
    if (params.couponCode) {
      try {
        const promos = await stripe.promotionCodes.list({ code: params.couponCode, active: true, limit: 1 })
        if (promos.data.length > 0) {
          promotionCodeId = promos.data[0].id
        }
      } catch (err) {
        // Ignora e não aplica o cupom pre-filled caso a Stripe falhe
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      // Cupom: se encontrado o ID, preenche; senão permite que o usuário digite
      ...(promotionCodeId
        ? { discounts: [{ promotion_code: promotionCodeId }] }
        : { allow_promotion_codes: true }),
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
