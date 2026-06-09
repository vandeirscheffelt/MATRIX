import type { FastifyInstance } from 'fastify'
import { processAffiliateSale } from './commission-engine.js'

export async function msStripeWebhookRoutes(app: FastifyInstance) {
  // POST /mastersaas/webhook/stripe
  // Recebe eventos do Stripe emitidos pelo Evolia após pagamento confirmado.
  //
  // Configurar no Stripe Dashboard:
  //   Endpoint URL: https://api.shaikron.scheffelt.xyz/mastersaas/webhook/stripe
  //   Eventos: checkout.session.completed, invoice.payment_succeeded, charge.refunded
  //
  // O Evolia deve incluir nos metadados do checkout session:
  //   metadata.affiliate_code  → código do afiliado (do src param)
  //   metadata.product_code    → código do produto
  //   metadata.src             → string src completa (MASTERSAAS|AFIL|code|product)
  //   metadata.phone           → telefone do comprador capturado pelo LIADS

  app.post('/', { config: { rawBody: true } }, async (request: any, reply) => {
    const sig    = request.headers['stripe-signature']
    const secret = process.env.STRIPE_WEBHOOK_SECRET_MASTERSAAS

    if (!secret) {
      app.log.error('STRIPE_WEBHOOK_SECRET_MASTERSAAS não configurado')
      return reply.code(500).send({ error: 'Webhook secret não configurado' })
    }

    let event: any
    try {
      const Stripe = require('stripe')
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
      event = stripe.webhooks.constructEvent(request.rawBody, sig, secret)
    } catch (err) {
      return reply.code(400).send({ error: `Assinatura inválida: ${(err as Error).message}` })
    }

    const obj = event.data.object

    switch (event.type) {
      // Pagamento único ou primeira parcela de subscription
      case 'checkout.session.completed': {
        const amountTotal: number = obj.amount_total ?? 0   // em centavos
        const currency: string    = (obj.currency ?? 'brl').toUpperCase()
        const email: string       = obj.customer_details?.email ?? obj.customer_email ?? ''

        if (!email || amountTotal <= 0) break

        try {
          const result = await processAffiliateSale({
            gateway:             'stripe',
            external_payment_id: obj.id,
            customer_email:      email,
            phone:               obj.customer_details?.phone ?? obj.metadata?.phone ?? null,
            revenue:             amountTotal / 100,          // centavos → reais/dólares
            currency,
            source:              obj.metadata?.src ?? null,
            raw_affiliate_code:  obj.metadata?.affiliate_code ?? null,
            raw_product_code:    obj.metadata?.product_code ?? null,
          }, app.log)

          app.log.info({ result, session_id: obj.id }, 'stripe mastersaas: checkout processado')
        } catch (err) {
          app.log.error({ err, session_id: obj.id }, 'stripe mastersaas: erro ao processar checkout')
          // Retorna 500 para o Stripe retentar o webhook
          return reply.code(500).send({ error: 'Erro interno ao processar pagamento' })
        }
        break
      }

      // Renovação mensal de assinatura (comissão recorrente)
      case 'invoice.payment_succeeded': {
        // Ignora a primeira fatura (já processada no checkout.session.completed)
        if (obj.billing_reason === 'subscription_create') break

        const amountPaid: number = obj.amount_paid ?? 0
        const currency: string   = (obj.currency ?? 'brl').toUpperCase()
        const email: string      = obj.customer_email ?? ''

        if (!email || amountPaid <= 0) break

        // Para renovações, o metadata está na subscription
        const subMetadata = obj.lines?.data?.[0]?.metadata ?? {}

        try {
          await processAffiliateSale({
            gateway:             'stripe',
            external_payment_id: obj.id,   // invoice ID — único por renovação
            customer_email:      email,
            phone:               null,
            revenue:             amountPaid / 100,
            currency,
            source:              subMetadata.src ?? null,
            raw_affiliate_code:  subMetadata.affiliate_code ?? null,
            raw_product_code:    subMetadata.product_code ?? null,
          }, app.log)
        } catch (err) {
          app.log.error({ err, invoice_id: obj.id }, 'stripe mastersaas: erro ao processar renovação')
          return reply.code(500).send({ error: 'Erro interno ao processar renovação' })
        }
        break
      }

      // Reembolso — marca a sale como refunded
      // A comissão é tratada manualmente pelo admin (commission_reversal via painel)
      case 'charge.refunded': {
        const paymentIntentId: string = obj.payment_intent ?? ''
        if (!paymentIntentId) break

        const { supabaseMasterSaaS } = await import('../../lib/supabase.js')
        const db = supabaseMasterSaaS()

        await db
          .from('sales')
          .update({ status: 'refunded' })
          .eq('gateway', 'stripe')
          .ilike('external_payment_id', `%${paymentIntentId}%`)

        app.log.info({ payment_intent: paymentIntentId }, 'stripe mastersaas: charge.refunded — sale marcada como refunded')
        break
      }
    }

    return { received: true }
  })
}
