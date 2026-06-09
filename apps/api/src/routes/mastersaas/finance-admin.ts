import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseMasterSaaS } from '../../lib/supabase.js'
import { requireMSAuth, requireMSAdmin } from './auth-guard.js'

// Transições válidas para override manual pelo admin
const VALID_ADMIN_TRANSITIONS: Record<string, string[]> = {
  pending:    ['available', 'canceled'],
  available:  ['processing', 'canceled'],
  processing: ['paid', 'failed', 'canceled'],
  failed:     ['processing', 'canceled'],
  paid:       ['refunded'],
  refunded:   [],
  canceled:   [],
}

const overrideStatusBody = z.object({
  status:     z.enum(['available', 'processing', 'paid', 'failed', 'canceled', 'refunded']),
  note:       z.string().min(5, 'Nota obrigatória (mínimo 5 caracteres) para override manual'),
  payment_id: z.string().optional(),
})

export async function msFinanceAdminRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()
  const preHandler = [requireMSAuth, requireMSAdmin]

  // ── GET /mastersaas/admin/finance/summary ────────────────────────────────
  // Visão consolidada financeira da plataforma
  app.get('/summary', { preHandler }, async (_request, reply) => {
    const { data: commissions, error } = await db
      .from('commissions')
      .select('commission, status, type')

    if (error) return reply.code(500).send({ error: error.message })

    const { data: withdrawals } = await db
      .from('withdrawals')
      .select('amount, status')

    const c = commissions ?? []
    const w = withdrawals ?? []

    const sumBy = (status: string) =>
      Number(c.filter((x: any) => x.status === status).reduce((s: number, x: any) => s + Number(x.commission), 0).toFixed(2))

    const wSumBy = (status: string) =>
      Number(w.filter((x: any) => x.status === status).reduce((s: number, x: any) => s + Number(x.amount), 0).toFixed(2))

    return {
      commissions: {
        pending:    sumBy('pending'),
        available:  sumBy('available'),
        processing: sumBy('processing'),
        paid:       sumBy('paid'),
        canceled:   sumBy('canceled'),
        refunded:   sumBy('refunded'),
        failed:     sumBy('failed'),
        total_direct:  Number(c.filter((x: any) => x.type === 'direct').reduce((s: number, x: any) => s + Number(x.commission), 0).toFixed(2)),
        total_network: Number(c.filter((x: any) => x.type === 'network').reduce((s: number, x: any) => s + Number(x.commission), 0).toFixed(2)),
      },
      withdrawals: {
        requested:  wSumBy('requested'),
        processing: wSumBy('processing'),
        paid:       wSumBy('paid'),
        failed:     wSumBy('failed'),
        canceled:   wSumBy('canceled'),
      },
      // Liquidez necessária = saques em requested + processing
      liquidity_needed: Number((wSumBy('requested') + wSumBy('processing')).toFixed(2)),
    }
  })

  // ── GET /mastersaas/admin/commissions ────────────────────────────────────
  // Lista todas as comissões com filtros avançados
  app.get<{
    Querystring: {
      affiliate_id?: string
      status?: string
      type?: string
      page?: string
      per_page?: string
    }
  }>('/commissions', { preHandler }, async (request, reply) => {
    const page    = Math.max(1, Number(request.query.page ?? 1))
    const perPage = Math.min(100, Math.max(1, Number(request.query.per_page ?? 20)))
    const from    = (page - 1) * perPage
    const to      = from + perPage - 1

    let q = db
      .from('commissions')
      .select(
        'id, type, affiliate_id, sale_id, campaign_id, parent_commission_id, revenue, commission, rate_snapshot, sale_date, hold_until, available_at, paid_at, canceled_at, payment_id, status, created_at',
        { count: 'exact' }
      )
      .order('sale_date', { ascending: false })
      .range(from, to)

    if (request.query.affiliate_id) q = q.eq('affiliate_id', request.query.affiliate_id)
    if (request.query.status)       q = q.eq('status',       request.query.status)
    if (request.query.type)         q = q.eq('type',         request.query.type)

    const { data, count, error } = await q
    if (error) return reply.code(500).send({ error: error.message })

    return {
      data,
      meta: {
        total:       count ?? 0,
        page,
        per_page:    perPage,
        total_pages: Math.ceil((count ?? 0) / perPage),
      },
    }
  })

  // ── GET /mastersaas/admin/commissions/:id ────────────────────────────────
  app.get<{ Params: { id: string } }>(
    '/commissions/:id',
    { preHandler },
    async (request, reply) => {
      const { data, error } = await db
        .from('commissions')
        .select('*')
        .eq('id', request.params.id)
        .single()

      if (error || !data) return reply.code(404).send({ error: 'Comissão não encontrada' })
      return data
    }
  )

  // ── PATCH /mastersaas/admin/commissions/:id/status ───────────────────────
  // Override manual com nota obrigatória + audit trail
  app.patch<{ Params: { id: string } }>(
    '/commissions/:id/status',
    { preHandler },
    async (request, reply) => {
      const body = overrideStatusBody.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const { status: newStatus, note, payment_id } = body.data
      const adminId = (request as any).msUserId

      const { data: commission } = await db
        .from('commissions')
        .select('id, status, affiliate_id')
        .eq('id', request.params.id)
        .single()

      if (!commission) return reply.code(404).send({ error: 'Comissão não encontrada' })

      const allowed = VALID_ADMIN_TRANSITIONS[commission.status] ?? []
      if (!allowed.includes(newStatus)) {
        return reply.code(409).send({
          error: `Transição '${commission.status}' → '${newStatus}' não é permitida.`,
          valid_transitions: allowed,
        })
      }

      if (newStatus === 'paid' && !payment_id) {
        return reply.code(400).send({ error: 'payment_id obrigatório ao marcar como paid.' })
      }

      const now = new Date().toISOString()
      const updateData: Record<string, any> = { status: newStatus }
      if (payment_id)               updateData.payment_id  = payment_id
      if (newStatus === 'available') updateData.available_at = now
      if (newStatus === 'paid')      updateData.paid_at      = now
      if (newStatus === 'canceled')  updateData.canceled_at  = now

      const { data: updated, error: updateError } = await db
        .from('commissions')
        .update(updateData)
        .eq('id', request.params.id)
        .select()
        .single()

      if (updateError) return reply.code(500).send({ error: updateError.message })

      // Registra audit trail (append-only)
      await db.from('commission_history').insert({
        commission_id: commission.id,
        from_status:   commission.status,
        to_status:     newStatus,
        changed_by:    adminId,
        note,
        ...(payment_id ? { note: `${note} | payment_id: ${payment_id}` } : {}),
      })

      return updated
    }
  )

  // ── GET /mastersaas/admin/commissions/:id/history ────────────────────────
  app.get<{ Params: { id: string } }>(
    '/commissions/:id/history',
    { preHandler },
    async (request, reply) => {
      const { data: commission } = await db
        .from('commissions')
        .select('id')
        .eq('id', request.params.id)
        .single()

      if (!commission) return reply.code(404).send({ error: 'Comissão não encontrada' })

      const { data, error } = await db
        .from('commission_history')
        .select('id, from_status, to_status, changed_by, note, changed_at')
        .eq('commission_id', request.params.id)
        .order('changed_at', { ascending: true })

      if (error) return reply.code(500).send({ error: error.message })
      return { data }
    }
  )

  // ── GET /mastersaas/admin/payout-batches ────────────────────────────────
  app.get<{ Querystring: { status?: string } }>(
    '/payout-batches',
    { preHandler },
    async (request, reply) => {
      let q = db
        .from('payout_batches')
        .select('id, created_by_admin_id, total_amount, currency, item_count, status, created_at, finalized_at')
        .order('created_at', { ascending: false })

      if (request.query.status) q = q.eq('status', request.query.status)

      const { data, error } = await q
      if (error) return reply.code(500).send({ error: error.message })
      return { data }
    }
  )

  // ── GET /mastersaas/admin/payout-batches/:id ────────────────────────────
  // Detalhe do batch com saques vinculados
  app.get<{ Params: { id: string } }>(
    '/payout-batches/:id',
    { preHandler },
    async (request, reply) => {
      const { data: batch, error } = await db
        .from('payout_batches')
        .select('*')
        .eq('id', request.params.id)
        .single()

      if (error || !batch) return reply.code(404).send({ error: 'Batch não encontrado' })

      const { data: withdrawals } = await db
        .from('withdrawals')
        .select('id, affiliate_id, amount, status, paid_at, payment_id, payment_method_snapshot')
        .eq('batch_id', request.params.id)

      return { ...batch, withdrawals: withdrawals ?? [] }
    }
  )

  // ── PATCH /mastersaas/admin/payout-batches/:id/finalize ─────────────────
  // Finaliza o batch após confirmar todos os pagamentos
  app.patch<{ Params: { id: string } }>(
    '/payout-batches/:id/finalize',
    { preHandler },
    async (request, reply) => {
      const { data: batch } = await db
        .from('payout_batches')
        .select('id, status, item_count')
        .eq('id', request.params.id)
        .single()

      if (!batch) return reply.code(404).send({ error: 'Batch não encontrado' })
      if (batch.status === 'finalized') {
        return reply.code(409).send({ error: 'Batch já finalizado.' })
      }

      // Conta quantos saques já foram pagos
      const { count: paidCount } = await db
        .from('withdrawals')
        .select('id', { count: 'exact', head: true })
        .eq('batch_id', request.params.id)
        .eq('status', 'paid')

      const { data, error } = await db
        .from('payout_batches')
        .update({ status: 'finalized', finalized_at: new Date().toISOString() })
        .eq('id', request.params.id)
        .select()
        .single()

      if (error) return reply.code(500).send({ error: error.message })

      return {
        ...data,
        paid_count:    paidCount ?? 0,
        pending_count: batch.item_count - (paidCount ?? 0),
      }
    }
  )

  // ── GET /mastersaas/admin/affiliates ────────────────────────────────────
  // Lista afiliados com métricas de comissão (leaderboard)
  app.get<{
    Querystring: { page?: string; per_page?: string; order?: string }
  }>('/affiliates', { preHandler }, async (request, reply) => {
    const page    = Math.max(1, Number(request.query.page ?? 1))
    const perPage = Math.min(50, Math.max(1, Number(request.query.per_page ?? 20)))
    const from    = (page - 1) * perPage
    const to      = from + perPage - 1

    // Busca perfis com métricas de comissão (join via affiliate_id)
    const { data: commissions, error } = await db
      .from('commissions')
      .select('affiliate_id, commission, status, type')

    if (error) return reply.code(500).send({ error: error.message })

    // Agrupa por afiliado
    const byAffiliate: Record<string, any> = {}
    for (const c of commissions ?? []) {
      if (!byAffiliate[c.affiliate_id]) {
        byAffiliate[c.affiliate_id] = {
          affiliate_id: c.affiliate_id,
          total_earned: 0,
          pending: 0,
          available: 0,
          paid: 0,
          sales_count: 0,
        }
      }
      const entry = byAffiliate[c.affiliate_id]
      if (c.type === 'direct') entry.sales_count++
      if (!['canceled','refunded'].includes(c.status)) entry.total_earned += Number(c.commission)
      if (c.status === 'pending')   entry.pending   += Number(c.commission)
      if (c.status === 'available') entry.available += Number(c.commission)
      if (c.status === 'paid')      entry.paid      += Number(c.commission)
    }

    const sorted = Object.values(byAffiliate)
      .map(e => ({ ...e, total_earned: Number(e.total_earned.toFixed(2)), pending: Number(e.pending.toFixed(2)), available: Number(e.available.toFixed(2)), paid: Number(e.paid.toFixed(2)) }))
      .sort((a, b) => b.total_earned - a.total_earned)

    const paginated = sorted.slice(from, to + 1)
    const total     = sorted.length

    return {
      data: paginated,
      meta: {
        total,
        page,
        per_page:    perPage,
        total_pages: Math.ceil(total / perPage),
      },
    }
  })
}
