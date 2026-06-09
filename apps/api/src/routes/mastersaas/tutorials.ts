import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseMasterSaaS } from '../../lib/supabase.js'
import { requireMSAuth, requireMSAdmin } from './auth-guard.js'

const tutorialBody = z.object({
  id:          z.string().min(1),
  youtube_url: z.string().url(),
  category:    z.enum(['getting-started', 'first-sale', 'scaling-sales', 'campaigns']),
  title:       z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  cta_to:      z.string().min(1),
  order:       z.number().int().min(0).default(0),
  active:      z.boolean().default(true),
  required:    z.boolean().default(false),
})

const newsBody = z.object({
  title:        z.string().min(1),
  body:         z.string().min(1),
  category:     z.string().optional().nullable(),
  active:       z.boolean().default(true),
  published_at: z.string().optional(),
})

export async function msTutorialsRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()

  // ── Públicas (afiliado) ───────────────────────────────────────────────────

  // GET /mastersaas/tutorials — lista tutoriais ativos
  app.get<{ Querystring: { category?: string; required?: string } }>(
    '/',
    async (request, reply) => {
      let q = db
        .from('tutorials')
        .select('id, youtube_url, youtube_id, category, title, description, cta_to, order, active, required')
        .eq('active', true)
        .order('order', { ascending: true })

      if (request.query.category) q = q.eq('category', request.query.category)
      if (request.query.required === 'true') q = q.eq('required', true)

      const { data, error } = await q
      if (error) return reply.code(500).send({ error: error.message })
      return { data }
    }
  )

  // GET /mastersaas/tutorials/progress — progresso do afiliado autenticado
  app.get(
    '/progress',
    { preHandler: [requireMSAuth] },
    async (request, reply) => {
      const affiliateId = (request as any).msUserId

      const [tutorialsRes, progressRes] = await Promise.all([
        db.from('tutorials').select('id, required').eq('active', true),
        db.from('tutorial_progress').select('tutorial_id, watched_at').eq('affiliate_id', affiliateId),
      ])

      const tutorials  = tutorialsRes.data  ?? []
      const progress   = progressRes.data   ?? []
      const watchedIds = new Set(progress.map((p: any) => p.tutorial_id))

      const required = tutorials.filter((t: any) => t.required)
      const completedRequired = required.filter((t: any) => watchedIds.has(t.id))

      return {
        total:              tutorials.length,
        watched:            progress.length,
        required_total:     required.length,
        required_completed: completedRequired.length,
        onboarding_done:    completedRequired.length === required.length && required.length > 0,
        watched_ids:        Array.from(watchedIds),
      }
    }
  )

  // POST /mastersaas/tutorials/:id/watch — marca tutorial como assistido
  app.post<{ Params: { id: string } }>(
    '/:id/watch',
    { preHandler: [requireMSAuth] },
    async (request, reply) => {
      const affiliateId = (request as any).msUserId

      const { data: tutorial } = await db
        .from('tutorials')
        .select('id')
        .eq('id', request.params.id)
        .single()

      if (!tutorial) return reply.code(404).send({ error: 'Tutorial não encontrado' })

      const { error } = await db
        .from('tutorial_progress')
        .upsert(
          { affiliate_id: affiliateId, tutorial_id: request.params.id },
          { onConflict: 'affiliate_id,tutorial_id', ignoreDuplicates: true }
        )

      if (error) return reply.code(500).send({ error: error.message })
      return { watched: true, tutorial_id: request.params.id }
    }
  )

  // ── Admin ─────────────────────────────────────────────────────────────────

  // POST /mastersaas/admin/tutorials — upsert por id
  app.post(
    '/admin',
    { preHandler: [requireMSAuth, requireMSAdmin] },
    async (request, reply) => {
      const body = tutorialBody.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const { data, error } = await db
        .from('tutorials')
        .upsert({ ...body.data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
        .select()
        .single()

      if (error) return reply.code(500).send({ error: error.message })
      return reply.code(201).send(data)
    }
  )

  // PATCH /mastersaas/admin/tutorials/:id/toggle
  app.patch<{ Params: { id: string } }>(
    '/admin/:id/toggle',
    { preHandler: [requireMSAuth, requireMSAdmin] },
    async (request, reply) => {
      const { data: existing } = await db.from('tutorials').select('id, active').eq('id', request.params.id).single()
      if (!existing) return reply.code(404).send({ error: 'Tutorial não encontrado' })

      const { data, error } = await db
        .from('tutorials')
        .update({ active: !existing.active, updated_at: new Date().toISOString() })
        .eq('id', request.params.id)
        .select('id, active')
        .single()

      if (error) return reply.code(500).send({ error: error.message })
      return data
    }
  )

  // DELETE /mastersaas/admin/tutorials/:id
  app.delete<{ Params: { id: string } }>(
    '/admin/:id',
    { preHandler: [requireMSAuth, requireMSAdmin] },
    async (request, reply) => {
      const { error } = await db.from('tutorials').delete().eq('id', request.params.id)
      if (error) return reply.code(500).send({ error: error.message })
      return reply.code(204).send()
    }
  )

  // ── News ─────────────────────────────────────────────────────────────────

  // GET /mastersaas/news
  app.get<{ Querystring: { page?: string } }>(
    '/news',
    async (request, reply) => {
      const page    = Math.max(1, Number(request.query.page ?? 1))
      const perPage = 10
      const from    = (page - 1) * perPage

      const { data, count, error } = await db
        .from('news')
        .select('id, title, body, category, published_at', { count: 'exact' })
        .eq('active', true)
        .order('published_at', { ascending: false })
        .range(from, from + perPage - 1)

      if (error) return reply.code(500).send({ error: error.message })
      return {
        data,
        meta: { total: count ?? 0, page, per_page: perPage, total_pages: Math.ceil((count ?? 0) / perPage) },
      }
    }
  )

  // POST /mastersaas/admin/news
  app.post(
    '/admin/news',
    { preHandler: [requireMSAuth, requireMSAdmin] },
    async (request, reply) => {
      const body = newsBody.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const { data, error } = await db.from('news').insert(body.data).select().single()
      if (error) return reply.code(500).send({ error: error.message })
      return reply.code(201).send(data)
    }
  )

  // PATCH /mastersaas/admin/news/:id
  app.patch<{ Params: { id: string } }>(
    '/admin/news/:id',
    { preHandler: [requireMSAuth, requireMSAdmin] },
    async (request, reply) => {
      const body = newsBody.partial().safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const { data, error } = await db
        .from('news')
        .update({ ...body.data, updated_at: new Date().toISOString() })
        .eq('id', request.params.id)
        .select()
        .single()

      if (error) return reply.code(500).send({ error: error.message })
      return data
    }
  )

  // DELETE /mastersaas/admin/news/:id
  app.delete<{ Params: { id: string } }>(
    '/admin/news/:id',
    { preHandler: [requireMSAuth, requireMSAdmin] },
    async (request, reply) => {
      const { error } = await db.from('news').delete().eq('id', request.params.id)
      if (error) return reply.code(500).send({ error: error.message })
      return reply.code(204).send()
    }
  )
}
