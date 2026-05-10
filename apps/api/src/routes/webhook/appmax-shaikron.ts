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
    // AppMax não tem metadata customizado — buscamos por order_id no nosso banco
    const orderId: string | undefined = String(data?.order_id ?? data?.id ?? '')

    app.log.info({ eventType, orderId }, 'appmax webhook recebido')

    // Busca a assinatura pelo order_id que armazenamos como appMaxSubscriptionId
    const findSub = async () => {
      if (!orderId) return null
      return prisma.subscription.findFirst({ where: { appMaxSubscriptionId: orderId } })
    }

    const periodEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    switch (eventType) {
      case 'payment.approved': {
        const sub = await findSub()
        if (!sub) break

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'ACTIVE',
            periodEndsAt,
            ...(data.customer_id ? { appMaxCustomerId: String(data.customer_id) } : {}),
          },
        })
        break
      }

      case 'payment.failed':
      case 'payment.cancelled': {
        const sub = await findSub()
        if (!sub) break
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'PAST_DUE' },
        })
        break
      }

      case 'order.updated': {
        // Verifica se o status do pedido indica pagamento aprovado
        if (data?.status === 'approved' || data?.payment_status === 'approved') {
          const sub = await findSub()
          if (!sub) break
          await prisma.subscription.update({
            where: { id: sub.id },
            data: { status: 'ACTIVE', periodEndsAt },
          })
        }
        break
      }
    }

    return { received: true }
  })
}
