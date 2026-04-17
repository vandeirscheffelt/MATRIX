import type { FastifyInstance } from 'fastify'
import { prisma } from '@boilerplate/database'

export async function stripeShaikronWebhookRoutes(app: FastifyInstance) {
  // POST /webhook/stripe/shaikron
  app.post('/', {
    config: { rawBody: true },
  }, async (request: any, reply) => {
    const sig = request.headers['stripe-signature']
    const secret = process.env.STRIPE_WEBHOOK_SECRET_SHAIKRON

    if (!secret) return reply.code(500).send({ error: 'Webhook secret não configurado' })

    let event: any
    try {
      const Stripe = require('stripe')
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
      event = stripe.webhooks.constructEvent(request.rawBody, sig, secret)
    } catch (err) {
      return reply.code(400).send({ error: `Webhook inválido: ${(err as Error).message}` })
    }

    const data = event.data.object
    const empresaId: string | undefined = data.metadata?.empresaId

    switch (event.type) {
      // Checkout concluído — subscription criada
      case 'checkout.session.completed': {
        if (!empresaId || data.mode !== 'subscription') break

        await prisma.subscription.upsert({
          where: { empresaId },
          create: {
            empresaId,
            stripeCustomerId: data.customer,
            stripeSubscriptionId: data.subscription,
            status: 'ACTIVE',
          },
          update: {
            stripeCustomerId: data.customer,
            stripeSubscriptionId: data.subscription,
            status: 'ACTIVE',
          },
        })
        break
      }

      // Pagamento confirmado — atualiza período
      case 'invoice.payment_succeeded': {
        const subId = data.subscription
        if (!subId) break

        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subId },
        })
        if (!sub) break

        const periodEnd = new Date(data.lines?.data?.[0]?.period?.end * 1000)
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'ACTIVE', periodEndsAt: periodEnd },
        })
        break
      }

      // Pagamento falhou
      case 'invoice.payment_failed': {
        const subId = data.subscription
        if (!subId) break

        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: subId },
        })
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'PAST_DUE' },
          })
        }
        break
      }

      // Assinatura cancelada
      case 'customer.subscription.deleted': {
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: data.id },
        })
        if (sub) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'CANCELED' },
          })
        }
        break
      }

      // Assinatura atualizada (ex: quantity de usuários extras)
      case 'customer.subscription.updated': {
        const sub = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: data.id },
        })
        if (!sub) break

        const status = data.status === 'active' ? 'ACTIVE'
          : data.status === 'past_due' ? 'PAST_DUE'
          : data.status === 'canceled' ? 'CANCELED'
          : undefined

        if (status) {
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status },
          })
        }
        break
      }
    }

    return { received: true }
  })
}
