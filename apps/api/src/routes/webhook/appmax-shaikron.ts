import type { FastifyInstance } from 'fastify'
import { prisma } from '@boilerplate/database'
import { createHmac } from 'crypto'

function validarAssinatura(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  return expected === signature
}

export async function appmaxShaikronWebhookRoutes(app: FastifyInstance) {
  // POST /webhook/appmax/shaikron
  app.post('/', {
    config: { rawBody: true },
  }, async (request: any, reply) => {
    const secret = process.env.APPMAX_WEBHOOK_SECRET
    const signature = request.headers['x-appmax-signature'] as string | undefined

    // Valida assinatura apenas se secret estiver configurado
    if (secret && signature) {
      if (!validarAssinatura(request.rawBody?.toString() ?? '', signature, secret)) {
        return reply.code(401).send({ error: 'Assinatura inválida' })
      }
    }

    const event = request.body as any
    const eventType: string = event?.event ?? ''
    const data = event?.data ?? {}

    // empresaId vem no metadata que enviamos ao criar a cobrança/assinatura
    const empresaId: string | undefined = data?.metadata?.empresaId ?? data?.order?.metadata?.empresaId

    app.log.info({ eventType, empresaId }, 'appmax webhook recebido')

    switch (eventType) {
      // Pagamento aprovado — ativa assinatura
      case 'payment.approved':
      case 'charge.approved': {
        if (!empresaId) break

        const expiresAt = data.expires_at ? new Date(data.expires_at) : null
        const periodEndsAt = expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        await prisma.subscription.upsert({
          where: { empresaId },
          create: {
            empresaId,
            paymentGateway: 'appmax',
            appMaxCustomerId: String(data.customer_id ?? ''),
            status: 'ACTIVE',
            periodEndsAt,
          },
          update: {
            status: 'ACTIVE',
            periodEndsAt,
            ...(data.customer_id ? { appMaxCustomerId: String(data.customer_id) } : {}),
          },
        })
        break
      }

      // Assinatura ativada (recorrência)
      case 'subscription.active':
      case 'subscription.renewed': {
        if (!empresaId) break

        const nextBilling = data.next_billing_at ? new Date(data.next_billing_at) : null

        await prisma.subscription.upsert({
          where: { empresaId },
          create: {
            empresaId,
            paymentGateway: 'appmax',
            appMaxCustomerId: String(data.customer_id ?? ''),
            appMaxSubscriptionId: String(data.id ?? ''),
            status: 'ACTIVE',
            ...(nextBilling ? { periodEndsAt: nextBilling } : {}),
          },
          update: {
            status: 'ACTIVE',
            ...(nextBilling ? { periodEndsAt: nextBilling } : {}),
            ...(data.id ? { appMaxSubscriptionId: String(data.id) } : {}),
          },
        })
        break
      }

      // Pagamento recusado / em atraso
      case 'payment.refused':
      case 'charge.refused':
      case 'subscription.overdue': {
        if (!empresaId) break

        await prisma.subscription.updateMany({
          where: { empresaId },
          data: { status: 'PAST_DUE' },
        })
        break
      }

      // Assinatura cancelada
      case 'subscription.canceled':
      case 'subscription.expired': {
        if (!empresaId) break

        await prisma.subscription.updateMany({
          where: { empresaId },
          data: { status: 'CANCELED' },
        })
        break
      }

      // Reembolso
      case 'payment.refunded':
      case 'charge.refunded': {
        if (!empresaId) break

        await prisma.subscription.updateMany({
          where: { empresaId },
          data: { status: 'CANCELED' },
        })
        break
      }
    }

    return { received: true }
  })
}
