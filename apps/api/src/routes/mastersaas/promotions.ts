import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseMasterSaaS } from '../../lib/supabase.js'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const promotionFields = z.object({
  name: z.string().min(1),
  product_slug: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date: formato YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date: formato YYYY-MM-DD'),
  commission_rate_override: z.number().min(0).max(100).optional().nullable(),
  duration_override: z.enum(['Lifetime', '12 months', '6 months', '3 months', 'Custom']).optional().nullable(),
  custom_duration_months: z.number().int().positive().optional().nullable(),
  enabled: z.boolean().default(true),
  performance_enabled: z.boolean().default(false),
  performance_min_sales: z.number().int().positive().optional().nullable(),
  performance_rate_if_reached: z.number().min(0).max(100).optional().nullable(),
  performance_rate_if_not_reached: z.number().min(0).max(100).optional().nullable(),
})

// Schema de criação — com validações cruzadas
const promotionBody = promotionFields.refine(
  d => d.end_date >= d.start_date,
  { message: 'end_date deve ser igual ou posterior a start_date', path: ['end_date'] }
).refine(
  d => !d.performance_enabled || (
    d.performance_min_sales != null &&
    d.performance_rate_if_reached != null &&
    d.performance_rate_if_not_reached != null
  ),
  { message: 'Performance Boost requer performance_min_sales, performance_rate_if_reached e performance_rate_if_not_reached', path: ['performance_enabled'] }
)

// Schema de atualização parcial — sem refine (validação de datas feita no handler)
const promotionPatch = promotionFields.partial()

const listQuerySchema = z.object({
  status: z.enum(['active', 'scheduled', 'expired', 'disabled']).optional(),
  product_slug: z.string().optional(),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Calcula status da promoção — nunca armazenado, sempre derivado
function resolveStatus(p: { enabled: boolean; start_date: string; end_date: string }, now = new Date()) {
  if (!p.enabled) return 'disabled'
  const start = new Date(p.start_date)
  const end = new Date(p.end_date + 'T23:59:59.999Z') // endDate inclui o dia inteiro
  if (now < start) return 'scheduled'
  if (now > end) return 'expired'
  return 'active'
}

function daysRemaining(p: { end_date: string }, now = new Date()) {
  const end = new Date(p.end_date + 'T23:59:59.999Z')
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000))
}

function maxAchievableRate(p: {
  commission_rate_override?: number | null
  performance_enabled?: boolean
  performance_rate_if_reached?: number | null
  performance_rate_if_not_reached?: number | null
}) {
  if (!p.performance_enabled) return p.commission_rate_override ?? null
  return Math.max(
    p.performance_rate_if_reached ?? 0,
    p.performance_rate_if_not_reached ?? 0
  ) || null
}

function enrichPromotion(p: any) {
  const now = new Date()
  return {
    ...p,
    status: resolveStatus(p, now),
    days_remaining: daysRemaining(p, now),
    max_achievable_rate: maxAchievableRate(p),
  }
}

// ─── Guard (reutiliza o mesmo padrão do products.ts) ─────────────────────────

import { supabaseAdmin } from '../../lib/supabase.js'

async function requireMasterSaaSAuth(request: any, reply: any) {
  const token = (request.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) return reply.code(401).send({ error: 'Token ausente' })
  const { data: { user }, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !user) return reply.code(401).send({ error: 'Token inválido' })
  request.msUserId = user.id
  request.msUserEmail = user.email
}

async function requireMasterSaaSAdmin(request: any, reply: any) {
  const adminEmails = (process.env.MASTERSAAS_ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!adminEmails.includes(request.msUserEmail)) {
    return reply.code(403).send({ error: 'Acesso restrito a administradores do MasterSaaS' })
  }
}

// ─── Rotas públicas ───────────────────────────────────────────────────────────

export async function msPromotionsPublicRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()

  // GET /mastersaas/promotions?status=active&product_slug=evolia-pro
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>('/', async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })

    let q = db.from('promotions').select('*').eq('enabled', true)

    if (query.data.product_slug) {
      q = q.eq('product_slug', query.data.product_slug)
    }

    const { data, error } = await q.order('start_date', { ascending: false })
    if (error) return reply.code(500).send({ error: error.message })

    let enriched = data.map(enrichPromotion)

    // Filtro de status calculado após enriquecimento
    if (query.data.status) {
      enriched = enriched.filter(p => p.status === query.data.status)
    }

    return { data: enriched }
  })

  // GET /mastersaas/promotions/active?product_slug=evolia-pro
  // Retorna a promoção ativa para um produto (ou null)
  app.get<{ Querystring: { product_slug?: string } }>('/active', async (request, reply) => {
    const { product_slug } = request.query
    if (!product_slug) return reply.code(400).send({ error: 'product_slug é obrigatório' })

    const now = new Date().toISOString().split('T')[0] // YYYY-MM-DD

    const { data, error } = await db
      .from('promotions')
      .select('*')
      .eq('product_slug', product_slug)
      .eq('enabled', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .order('start_date', { ascending: false })
      .limit(1)

    if (error) return reply.code(500).send({ error: error.message })

    const promo = data[0] ?? null
    return promo ? enrichPromotion(promo) : null
  })

  // GET /mastersaas/promotions/:id
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { data, error } = await db
      .from('promotions')
      .select('*')
      .eq('id', request.params.id)
      .single()

    if (error || !data) return reply.code(404).send({ error: 'Promoção não encontrada' })
    return enrichPromotion(data)
  })
}

// ─── Rotas admin ──────────────────────────────────────────────────────────────

export async function msPromotionsAdminRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()
  const preHandler = [requireMasterSaaSAuth, requireMasterSaaSAdmin]

  // GET /mastersaas/admin/promotions — lista todas incluindo desativadas
  app.get<{ Querystring: z.infer<typeof listQuerySchema> }>('/', { preHandler }, async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query)

    let q = db.from('promotions').select('*')
    if (query.success && query.data.product_slug) {
      q = q.eq('product_slug', query.data.product_slug)
    }

    const { data, error } = await q.order('start_date', { ascending: false })
    if (error) return reply.code(500).send({ error: error.message })

    let enriched = data.map(enrichPromotion)
    if (query.success && query.data.status) {
      enriched = enriched.filter(p => p.status === query.data.status)
    }

    return { data: enriched }
  })

  // POST /mastersaas/admin/promotions — cria promoção
  app.post('/', { preHandler }, async (request, reply) => {
    const body = promotionBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    // Verifica se produto existe
    const { data: product } = await db
      .from('products')
      .select('slug')
      .eq('slug', body.data.product_slug)
      .single()

    if (!product) return reply.code(404).send({ error: `Produto '${body.data.product_slug}' não encontrado` })

    // Alerta (não bloqueia) se já há promoção ativa para o produto
    const now = new Date().toISOString().split('T')[0]
    const { data: existing } = await db
      .from('promotions')
      .select('id, name')
      .eq('product_slug', body.data.product_slug)
      .eq('enabled', true)
      .lte('start_date', now)
      .gte('end_date', now)
      .limit(1)

    const { data, error } = await db
      .from('promotions')
      .insert(body.data)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })

    return reply.code(201).send({
      ...enrichPromotion(data),
      _warning: existing?.[0]
        ? `Produto já possui promoção ativa '${existing[0].name}' (id: ${existing[0].id}). Duas promoções ativas para o mesmo produto podem causar comportamento não-determinístico.`
        : undefined,
    })
  })

  // PATCH /mastersaas/admin/promotions/:id — atualização parcial
  app.patch<{ Params: { id: string } }>('/:id', { preHandler }, async (request, reply) => {
    const body = promotionPatch.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data: existing } = await db
      .from('promotions')
      .select('id, start_date, end_date, enabled')
      .eq('id', request.params.id)
      .single()

    if (!existing) return reply.code(404).send({ error: 'Promoção não encontrada' })

    // Valida datas após merge com valores existentes
    const merged = { ...existing, ...body.data }
    if (merged.end_date < merged.start_date) {
      return reply.code(400).send({ error: 'end_date deve ser igual ou posterior a start_date' })
    }

    const { data, error } = await db
      .from('promotions')
      .update({ ...body.data, updated_at: new Date().toISOString() })
      .eq('id', request.params.id)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return enrichPromotion(data)
  })

  // PATCH /mastersaas/admin/promotions/:id/toggle — ativa/desativa
  app.patch<{ Params: { id: string } }>('/:id/toggle', { preHandler }, async (request, reply) => {
    const { data: existing } = await db
      .from('promotions')
      .select('id, enabled')
      .eq('id', request.params.id)
      .single()

    if (!existing) return reply.code(404).send({ error: 'Promoção não encontrada' })

    const { data, error } = await db
      .from('promotions')
      .update({ enabled: !existing.enabled, updated_at: new Date().toISOString() })
      .eq('id', request.params.id)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return { id: data.id, enabled: data.enabled, status: resolveStatus(data) }
  })

  // DELETE /mastersaas/admin/promotions/:id
  // Bloqueia se houver comissões vinculadas à promoção
  app.delete<{ Params: { id: string } }>('/:id', { preHandler }, async (request, reply) => {
    const { data: existing } = await db
      .from('promotions')
      .select('id')
      .eq('id', request.params.id)
      .single()

    if (!existing) return reply.code(404).send({ error: 'Promoção não encontrada' })

    const { count } = await db
      .from('commissions')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', request.params.id)

    if ((count ?? 0) > 0) {
      return reply.code(409).send({
        error: `Promoção possui ${count} comissão(ões) vinculada(s). Desative-a em vez de excluir.`,
      })
    }

    const { error } = await db
      .from('promotions')
      .delete()
      .eq('id', request.params.id)

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })

  // POST /mastersaas/admin/promotions/:id/resolve-rate
  // Calcula taxa efetiva de uma promoção dado o número de vendas do afiliado na campanha
  // Usado internamente para preview e pelo webhook de vendas
  app.post<{ Params: { id: string }; Body: { affiliate_sales_in_campaign: number } }>(
    '/:id/resolve-rate',
    { preHandler },
    async (request, reply) => {
      const { affiliate_sales_in_campaign = 0 } = request.body ?? {}

      const { data: promo } = await db
        .from('promotions')
        .select('commission_rate_override, performance_enabled, performance_min_sales, performance_rate_if_reached, performance_rate_if_not_reached')
        .eq('id', request.params.id)
        .single()

      if (!promo) return reply.code(404).send({ error: 'Promoção não encontrada' })

      let effective_rate: number | null = null

      if (!promo.performance_enabled) {
        effective_rate = promo.commission_rate_override ?? null
      } else {
        // Performance Boost — prospectivo (ADR-007)
        const reached = affiliate_sales_in_campaign >= (promo.performance_min_sales ?? Infinity)
        effective_rate = reached
          ? promo.performance_rate_if_reached
          : promo.performance_rate_if_not_reached
      }

      return {
        effective_rate,
        affiliate_sales_in_campaign,
        boost_active: promo.performance_enabled && affiliate_sales_in_campaign >= (promo.performance_min_sales ?? Infinity),
      }
    }
  )
}
