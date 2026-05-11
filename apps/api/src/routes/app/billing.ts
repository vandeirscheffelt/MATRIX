import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth } from '../../lib/auth.js'
import { getGateway, getGatewayByName } from '@boilerplate/billing'

// Preços canônicos do Shaikron (Stripe, usado para update-subscription)
const PRICE_USUARIO_EXTRA = process.env.STRIPE_PRICE_SHAIKRON_USUARIO_EXTRA ?? ''

function getStripe() {
  const Stripe = require('stripe')
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })
}

export async function billingRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth]

  // GET /app/billing/status
  app.get('/status', { preHandler }, async (request: any, reply) => {
    const sub = await prisma.subscription.findUnique({
      where: { empresaId: request.empresaId },
    })
    if (!sub) return reply.code(404).send({ error: 'Sem registro de assinatura' })

    const now = new Date()
    let diasRestantes: number | null = null
    let bloqueado = false

    if (sub.status === 'TRIAL' && sub.trialEndsAt) {
      diasRestantes = Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86400000))
      bloqueado = diasRestantes === 0
    }

    if (sub.status === 'ACTIVE' && sub.periodEndsAt) {
      diasRestantes = Math.max(0, Math.ceil((sub.periodEndsAt.getTime() - now.getTime()) / 86400000))
    }

    if (['CANCELED', 'PAST_DUE'].includes(sub.status)) {
      bloqueado = true
    }

    // Quantidade de usuários extras na assinatura Stripe
    let usuariosExtras = 0
    if (sub.stripeSubscriptionId) {
      try {
        const stripe = getStripe()
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId)
        const itemExtra = stripeSub.items.data.find(
          (i: any) => i.price.id === PRICE_USUARIO_EXTRA
        )
        usuariosExtras = itemExtra?.quantity ?? 0
      } catch { /* ignora erro de rede */ }
    }

    return {
      status: sub.status,
      dias_restantes: diasRestantes,
      bloqueado,
      usuarios_extras: usuariosExtras,
      trial_ends_at: sub.trialEndsAt,
      period_ends_at: sub.periodEndsAt,
    }
  })

  // POST /app/billing/checkout — inicia checkout do plano base R$ 97/mês
  // paymentMethod: 'pix' | 'boleto' | 'card_br' | 'card_intl'
  app.post('/checkout', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
      paymentMethod: z.enum(['pix', 'boleto', 'card_br', 'card_intl']).default('card_br'),
      userCpf: z.string().optional(),
      usuariosExtras: z.number().int().min(0).default(0),
      couponCode: z.string().trim().optional(),   // código de cupom/promoção opcional
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    request.log.info({ paymentMethod: body.data.paymentMethod, usuariosExtras: body.data.usuariosExtras, rawBody: request.body }, 'checkout body recebido')

    if (body.data.paymentMethod === 'pix' || body.data.paymentMethod === 'boleto') {
      const doc = body.data.userCpf?.replace(/\D/g, '') ?? ''
      if (doc.length !== 11 && doc.length !== 14) {
        return reply.code(400).send({ error: 'CPF (11 dígitos) ou CNPJ (14 dígitos) obrigatório para PIX e Boleto' })
      }
    }

    const gateway = getGateway(body.data.paymentMethod)

    try {
      const result = await gateway.createCheckout({
        empresaId: request.empresaId,
        userId: request.userId,
        userEmail: request.userEmail,
        userCpf: body.data.userCpf,
        paymentMethod: body.data.paymentMethod,
        successUrl: body.data.successUrl,
        cancelUrl: body.data.cancelUrl,
        usuariosExtras: body.data.usuariosExtras,
        couponCode: body.data.couponCode,
      })

      // Persiste qual gateway foi escolhido (para o webhook saber onde atualizar)
      await prisma.subscription.upsert({
        where: { empresaId: request.empresaId },
        create: {
          empresaId: request.empresaId,
          paymentGateway: result.gateway,
          ...(result.gateway === 'stripe'
            ? { stripeCustomerId: result.customerId }
            : { appMaxCustomerId: result.customerId, appMaxSubscriptionId: result.subscriptionId }),
        },
        update: {
          paymentGateway: result.gateway,
          ...(result.gateway === 'stripe'
            ? { stripeCustomerId: result.customerId }
            : { appMaxCustomerId: result.customerId, ...(result.subscriptionId ? { appMaxSubscriptionId: result.subscriptionId } : {}) }),
        },
      })

      return result
    } catch (err: any) {
      request.log.error({ err: err?.message }, 'billing.checkout failed')
      return reply.code(500).send({ error: err?.message ?? 'Erro ao iniciar checkout' })
    }
  })

  // POST /app/billing/update-subscription — adiciona ou remove usuários extras (R$ 29,90)
  app.post('/update-subscription', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      quantidade: z.number().int().min(0),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const sub = await prisma.subscription.findUnique({ where: { empresaId: request.empresaId } })
    if (!sub?.stripeSubscriptionId) {
      return reply.code(422).send({ error: 'Sem assinatura ativa para atualizar' })
    }

    if (!PRICE_USUARIO_EXTRA) {
      return reply.code(500).send({ error: 'STRIPE_PRICE_SHAIKRON_USUARIO_EXTRA não configurada' })
    }

    const stripe = getStripe()
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId)
    const itemExtra = stripeSub.items.data.find((i: any) => i.price.id === PRICE_USUARIO_EXTRA)

    if (body.data.quantidade === 0) {
      // Remove o item de usuário extra se existir
      if (itemExtra) {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          items: [{ id: itemExtra.id, deleted: true }],
          proration_behavior: 'create_prorations',
        })
      }
    } else if (itemExtra) {
      // Atualiza quantidade existente
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: itemExtra.id, quantity: body.data.quantidade }],
        proration_behavior: 'create_prorations',
      })
    } else {
      // Adiciona item de usuário extra
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ price: PRICE_USUARIO_EXTRA, quantity: body.data.quantidade }],
        proration_behavior: 'create_prorations',
      })
    }

    return { ok: true, usuarios_extras: body.data.quantidade }
  })

  // POST /app/billing/manager-phone — salva telefone do gerente para resumos
  app.post('/manager-phone', { preHandler }, async (request: any, reply) => {
    const body = z.object({ telefone: z.string().min(10) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const gerente = await prisma.numeroGerente.upsert({
      where: {
        id: (await prisma.numeroGerente.findFirst({
          where: { empresaId: request.empresaId },
          select: { id: true },
        }))?.id ?? '',
      },
      create: { empresaId: request.empresaId, telefone: body.data.telefone },
      update: { telefone: body.data.telefone },
    })

    return gerente
  })

  // POST /app/billing/portal — link do portal (Stripe ou AppMax conforme gateway ativo)
  app.post('/portal', { preHandler }, async (request: any, reply) => {
    const body = z.object({ returnUrl: z.string().url() }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const sub = await prisma.subscription.findUnique({ where: { empresaId: request.empresaId } })
    if (!sub) return reply.code(404).send({ error: 'Sem assinatura vinculada' })

    const gateway = getGatewayByName(sub.paymentGateway ?? 'stripe')
    const customerId = sub.paymentGateway === 'appmax' ? (sub.appMaxCustomerId ?? '') : (sub.stripeCustomerId ?? '')

    if (!customerId) return reply.code(404).send({ error: 'Sem customer vinculado ao gateway' })

    const { url } = await gateway.createPortalSession({
      empresaId: request.empresaId,
      customerId,
      returnUrl: body.data.returnUrl,
    })

    return { url }
  })
}
