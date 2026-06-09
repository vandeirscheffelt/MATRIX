import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseAdmin, supabaseMasterSaaS } from '../../lib/supabase.js'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const productBody = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug: apenas letras minúsculas, números e hífen'),
  name: z.string().min(1),
  description: z.string().optional(),
  tagline: z.string().optional(),
  prices: z.record(z.number().positive()).default({}),
  fallback_currency: z.string().default('BRL'),
  commission_rate: z.number().min(0).max(100).optional(),
  commission_duration: z.enum(['Lifetime', '12 months', '6 months', '3 months', 'Custom']).optional(),
  custom_duration_months: z.number().int().positive().optional(),
  billing_type: z.enum(['Monthly', 'Annual']).optional(),
  active: z.boolean().default(true),
  accepting_subscriptions: z.boolean().default(true),
  cover_image: z.string().optional(),
  product_url: z.string().url('product_url deve ser uma URL válida'),
  product_code: z.string().min(1),
  sales_copy: z.record(z.unknown()).optional(),
})

const priceQuerySchema = z.object({
  currency: z.string().optional(),
})

// ─── Guard: JWT do MasterSaaS ─────────────────────────────────────────────────
// Valida o Bearer token do Supabase (projeto tbapcaxbawruijrigafn)
// e verifica se o perfil tem permissão de admin (role injetado pelo email no .env)

async function requireMasterSaaSAuth(request: any, reply: any) {
  const token = (request.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) return reply.code(401).send({ error: 'Token ausente' })

  const { data: { user }, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !user) return reply.code(401).send({ error: 'Token inválido' })

  request.msUserId = user.id
  request.msUserEmail = user.email
}

async function requireMasterSaaSAdmin(request: any, reply: any) {
  // Admin = email configurado em MASTERSAAS_ADMIN_EMAIL ou role na tabela profiles
  const adminEmails = (process.env.MASTERSAAS_ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!adminEmails.includes(request.msUserEmail)) {
    return reply.code(403).send({ error: 'Acesso restrito a administradores do MasterSaaS' })
  }
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

export async function msProductsPublicRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()

  // GET /mastersaas/products — leitura pública com resolução de preço
  app.get<{ Querystring: { currency?: string } }>('/', async (request, reply) => {
    const query = priceQuerySchema.safeParse(request.query)
    const preferredCurrency = query.success ? query.data.currency : undefined

    const { data, error } = await db
      .from('products')
      .select('slug, name, description, tagline, prices, fallback_currency, commission_rate, commission_duration, active, accepting_subscriptions, cover_image, product_url, product_code, sales_copy')
      .eq('active', true)
      .order('name')

    if (error) return reply.code(500).send({ error: error.message })

    // Resolve preço na currency preferida: preferred > fallback > BRL
    const resolved = data.map((p: any) => {
      const currency = preferredCurrency && p.prices[preferredCurrency] != null
        ? preferredCurrency
        : p.fallback_currency && p.prices[p.fallback_currency] != null
          ? p.fallback_currency
          : 'BRL'

      return {
        ...p,
        resolved_price: { price: p.prices[currency] ?? null, currency },
      }
    })

    return { data: resolved }
  })

  // GET /mastersaas/products/:slug — detalhe público
  app.get<{ Params: { slug: string }; Querystring: { currency?: string } }>(
    '/:slug',
    async (request, reply) => {
      const { data, error } = await db
        .from('products')
        .select('*')
        .eq('slug', request.params.slug)
        .eq('active', true)
        .single()

      if (error || !data) return reply.code(404).send({ error: 'Produto não encontrado' })
      return data
    }
  )
}

export async function msProductsAdminRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()
  const preHandler = [requireMasterSaaSAuth, requireMasterSaaSAdmin]

  // GET /mastersaas/admin/products — lista todos (inclusive inativos)
  app.get('/', { preHandler }, async (_request, reply) => {
    const { data, error } = await db
      .from('products')
      .select('*')
      .order('name')

    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // POST /mastersaas/admin/products — cria produto (upsert por slug)
  app.post('/', { preHandler }, async (request, reply) => {
    const body = productBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await db
      .from('products')
      .upsert(body.data, { onConflict: 'slug' })
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  // PATCH /mastersaas/admin/products/:slug — atualização parcial
  app.patch<{ Params: { slug: string } }>('/:slug', { preHandler }, async (request, reply) => {
    const body = productBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    // Bloquear alteração de slug via PATCH
    const { slug: _ignored, ...updateData } = body.data as any

    const { data: existing } = await db
      .from('products')
      .select('slug')
      .eq('slug', request.params.slug)
      .single()

    if (!existing) return reply.code(404).send({ error: 'Produto não encontrado' })

    const { data, error } = await db
      .from('products')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('slug', request.params.slug)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // PATCH /mastersaas/admin/products/:slug/toggle — ativa/inativa
  app.patch<{ Params: { slug: string } }>('/:slug/toggle', { preHandler }, async (request, reply) => {
    const { data: existing } = await db
      .from('products')
      .select('slug, active')
      .eq('slug', request.params.slug)
      .single()

    if (!existing) return reply.code(404).send({ error: 'Produto não encontrado' })

    const { data, error } = await db
      .from('products')
      .update({ active: !existing.active, updated_at: new Date().toISOString() })
      .eq('slug', request.params.slug)
      .select('slug, active')
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // DELETE /mastersaas/admin/products/:slug — remove produto
  // Só permitido se não houver sales vinculadas
  app.delete<{ Params: { slug: string } }>('/:slug', { preHandler }, async (request, reply) => {
    const { data: existing } = await db
      .from('products')
      .select('slug')
      .eq('slug', request.params.slug)
      .single()

    if (!existing) return reply.code(404).send({ error: 'Produto não encontrado' })

    // Verifica se há vendas vinculadas
    const { count } = await db
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('product_slug', request.params.slug)

    if ((count ?? 0) > 0) {
      return reply.code(409).send({
        error: `Produto possui ${count} venda(s) vinculada(s). Inative-o em vez de excluir.`,
      })
    }

    const { error } = await db
      .from('products')
      .delete()
      .eq('slug', request.params.slug)

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
