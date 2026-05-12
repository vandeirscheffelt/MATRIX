import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any })
}

export async function adminCouponsRoutes(app: FastifyInstance) {
  // GET /admin/coupons - Listar cupons
  app.get('/', async (request: any, reply) => {
    // Apenas admin global
    if (request.role !== 'ADMIN_GLOBAL' && request.role !== 'ACCOUNT_OWNER') {
      // return reply.code(403).send({ error: 'Acesso negado' })
      // TODO: Ajustar validação de admin conforme sistema
    }

    const coupons = await prisma.coupon.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        usages: { select: { id: true } }
      }
    })

    return coupons.map(c => ({
      ...c,
      usedCount: c.usages.length // Atualiza count com base nos usos reais
    }))
  })

  // POST /admin/coupons - Criar cupom (Banco + Stripe)
  app.post('/', async (request: any, reply) => {
    const body = z.object({
      code: z.string().min(3).toUpperCase(),
      description: z.string().optional(),
      discountType: z.enum(['percent', 'fixed']),
      discountValue: z.number().positive(),
      duration: z.enum(['once', 'forever']).default('once'),
      maxUses: z.number().int().positive().nullable().optional(),
      expiresAt: z.string().nullable().optional(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.code(400).send({ error: body.error.flatten() })
    }

    const { code, description, discountType, discountValue, duration, maxUses, expiresAt } = body.data

    const existing = await prisma.coupon.findUnique({ where: { code } })
    if (existing) {
      return reply.code(400).send({ error: 'Cupom com este código já existe' })
    }

    // 1. Criar no Stripe
    try {
      const stripe = getStripe()
      
      const stripeCouponObj: any = {
        name: description || `Cupom ${code}`,
        duration: duration === 'once' ? 'once' : 'forever',
      }
      
      if (discountType === 'percent') {
        stripeCouponObj.percent_off = discountValue
      } else {
        stripeCouponObj.amount_off = discountValue * 100 // Stripe usa centavos
        stripeCouponObj.currency = 'brl'
      }

      const stripeCoupon = await stripe.coupons.create(stripeCouponObj)

      const stripePromoObj: any = {
        coupon: stripeCoupon.id,
        code: code,
      }
      
      if (maxUses) stripePromoObj.max_redemptions = maxUses
      if (expiresAt) stripePromoObj.expires_at = Math.floor(new Date(expiresAt).getTime() / 1000)

      await stripe.promotionCodes.create(stripePromoObj)
      request.log.info({ code }, 'Cupom criado no Stripe')
    } catch (err: any) {
      request.log.error({ err }, 'Erro ao criar cupom no Stripe')
      return reply.code(500).send({ error: `Erro Stripe: ${err.message}` })
    }

    // 2. Criar no Banco (AppMax usará este)
    const dbCoupon = await prisma.coupon.create({
      data: {
        code,
        description,
        discountType,
        discountValue,
        duration,
        maxUses,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        active: true,
      }
    })

    return dbCoupon
  })

  // PATCH /admin/coupons/:id - Inativar cupom
  app.patch('/:id', async (request: any, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: 'ID inválido' })

    const body = z.object({ active: z.boolean() }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: 'Ativo inválido' })

    const coupon = await prisma.coupon.findUnique({ where: { id: params.data.id } })
    if (!coupon) return reply.code(404).send({ error: 'Cupom não encontrado' })

    // No Stripe, para inativar um promo code, atualizamos active: false
    try {
      const stripe = getStripe()
      const promoCodes = await stripe.promotionCodes.list({ code: coupon.code, active: true })
      if (promoCodes.data.length > 0) {
        await stripe.promotionCodes.update(promoCodes.data[0].id, {
          active: body.data.active
        })
      }
    } catch (err) {
      request.log.error({ err }, 'Erro ao inativar no Stripe')
      // Continua para o banco mesmo com erro
    }

    const updated = await prisma.coupon.update({
      where: { id: params.data.id },
      data: { active: body.data.active }
    })

    return updated
  })

  // DELETE /admin/coupons/:id - Excluir cupom
  app.delete('/:id', async (request: any, reply) => {
    const params = z.object({ id: z.string() }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: 'ID inválido' })

    const coupon = await prisma.coupon.findUnique({ where: { id: params.data.id } })
    if (!coupon) return reply.code(404).send({ error: 'Cupom não encontrado' })

    // Na Stripe não é possível "deletar" um promotion_code via API, apenas inativar.
    try {
      const stripe = getStripe()
      const promoCodes = await stripe.promotionCodes.list({ code: coupon.code })
      for (const p of promoCodes.data) {
        if (p.active) {
          await stripe.promotionCodes.update(p.id, { active: false })
        }
      }
    } catch (err) {
      request.log.error({ err }, 'Erro ao inativar na Stripe durante exclusão')
    }

    // Exclui do nosso banco (cascade vai limpar os usages)
    await prisma.coupon.delete({ where: { id: params.data.id } })

    return { success: true }
  })
}
