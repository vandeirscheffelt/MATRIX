import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { createCheckoutSession, createPortalSession } from '@boilerplate/billing'
import { requireAuth } from '../../lib/auth.js'

const checkoutBody = z.object({
  priceId: z.string(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
})

const portalBody = z.object({
  returnUrl: z.string().url(),
})

export async function subscriptionRoutes(app: FastifyInstance) {
  // GET /app/subscription
  app.get('/', { preHandler: requireAuth }, async (request: any) => {
    const sub = await prisma.subscription.findUnique({
      where: { empresaId: request.empresaId },
    })
    return sub
  })

  // POST /app/subscription/checkout
  app.post('/checkout', { preHandler: requireAuth }, async (request: any, reply) => {
    const body = checkoutBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const result = await createCheckoutSession({
      userId: request.userId,
      userEmail: request.userEmail,
      ...body.data,
    })

    if (result.error) return reply.code(500).send({ error: result.error })
    return result.data
  })

  // POST /app/subscription/portal
  app.post('/portal', { preHandler: requireAuth }, async (request: any, reply) => {
    const body = portalBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const sub = await prisma.subscription.findUnique({ where: { empresaId: request.empresaId } })
    if (!sub?.stripeCustomerId) return reply.code(404).send({ error: 'Sem assinatura Stripe' })

    const result = await createPortalSession({
      stripeCustomerId: sub.stripeCustomerId,
      returnUrl: body.data.returnUrl,
    })

    if (result.error) return reply.code(500).send({ error: result.error })
    return result.data
  })
}
