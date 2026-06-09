import type { FastifyInstance } from 'fastify'
import { supabaseAdmin, supabaseMasterSaaS } from '../../lib/supabase.js'
import { requireMSAuth } from './auth-guard.js'

export async function msFinanceAffiliateRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()

  // GET /mastersaas/me/balance — saldo real do afiliado
  // Substitui os dados do localStorage (GAP-SEC-02 fechado)
  app.get('/balance', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId

    const { data: commissions, error } = await db
      .from('commissions')
      .select('commission, status')
      .eq('affiliate_id', affiliateId)

    if (error) return reply.code(500).send({ error: error.message })

    const { data: withdrawals } = await db
      .from('withdrawals')
      .select('amount, status')
      .eq('affiliate_id', affiliateId)

    const c = commissions ?? []
    const w = withdrawals ?? []

    const totalAvailable  = c.filter((x: any) => x.status === 'available').reduce((s: number, x: any) => s + Number(x.commission), 0)
    const totalPending    = c.filter((x: any) => x.status === 'pending').reduce((s: number, x: any) => s + Number(x.commission), 0)
    const totalEarned     = c.filter((x: any) => !['canceled', 'refunded'].includes(x.status)).reduce((s: number, x: any) => s + Number(x.commission), 0)
    const totalWithdrawn  = w.filter((x: any) => x.status === 'paid').reduce((s: number, x: any) => s + Number(x.amount), 0)
    const inFlight        = w.filter((x: any) => ['processing'].includes(x.status)).reduce((s: number, x: any) => s + Number(x.amount), 0)

    // Saldo disponível = available - processing/paid (bloqueado por saque em andamento)
    const availableBalance = Number((totalAvailable - inFlight).toFixed(2))

    return {
      available_balance:  availableBalance,
      pending_balance:    Number(totalPending.toFixed(2)),
      total_earned:       Number(totalEarned.toFixed(2)),
      total_withdrawn:    Number(totalWithdrawn.toFixed(2)),
    }
  })

  // GET /mastersaas/me/commissions — histórico de comissões com filtros
  app.get<{
    Querystring: {
      status?: string
      type?: string
      page?: string
      per_page?: string
    }
  }>('/commissions', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId
    const page        = Math.max(1, Number(request.query.page ?? 1))
    const perPage     = Math.min(50, Math.max(1, Number(request.query.per_page ?? 20)))
    const from        = (page - 1) * perPage
    const to          = from + perPage - 1

    let q = db
      .from('commissions')
      .select('id, type, sale_id, campaign_id, revenue, commission, rate_snapshot, sale_date, hold_until, available_at, paid_at, status, created_at', { count: 'exact' })
      .eq('affiliate_id', affiliateId)
      .order('sale_date', { ascending: false })
      .range(from, to)

    if (request.query.status) q = q.eq('status', request.query.status)
    if (request.query.type)   q = q.eq('type',   request.query.type)

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

  // GET /mastersaas/me/commissions/:id/history — trilha de auditoria de uma comissão
  app.get<{ Params: { id: string } }>(
    '/commissions/:id/history',
    { preHandler: [requireMSAuth] },
    async (request, reply) => {
      const affiliateId = (request as any).msUserId

      // Verifica que a comissão pertence ao afiliado
      const { data: commission } = await db
        .from('commissions')
        .select('id')
        .eq('id', request.params.id)
        .eq('affiliate_id', affiliateId)
        .single()

      if (!commission) return reply.code(404).send({ error: 'Comissão não encontrada' })

      const { data, error } = await db
        .from('commission_history')
        .select('id, from_status, to_status, note, changed_at')
        .eq('commission_id', request.params.id)
        .order('changed_at', { ascending: true })

      if (error) return reply.code(500).send({ error: error.message })
      return { data }
    }
  )

  // GET /mastersaas/me/transactions — extrato unificado (comissões + saques)
  app.get<{
    Querystring: { page?: string; per_page?: string }
  }>('/transactions', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId
    const page        = Math.max(1, Number(request.query.page ?? 1))
    const perPage     = Math.min(50, Math.max(1, Number(request.query.per_page ?? 20)))

    const [commissionsRes, withdrawalsRes] = await Promise.all([
      db
        .from('commissions')
        .select('id, type, commission, status, sale_date, hold_until, available_at')
        .eq('affiliate_id', affiliateId)
        .order('sale_date', { ascending: false })
        .limit(100),

      db
        .from('withdrawals')
        .select('id, amount, status, requested_at, paid_at')
        .eq('affiliate_id', affiliateId)
        .order('requested_at', { ascending: false })
        .limit(100),
    ])

    // Unifica e ordena por data desc
    const commissionItems = (commissionsRes.data ?? []).map((c: any) => ({
      id:          c.id,
      date:        c.sale_date,
      type:        c.type === 'network' ? 'CommissionNetwork' : 'CommissionDirect',
      amount:      Number(c.commission),
      status:      c.status,
      hold_until:  c.hold_until,
      available_at: c.available_at,
    }))

    const withdrawalItems = (withdrawalsRes.data ?? []).map((w: any) => ({
      id:     w.id,
      date:   w.requested_at,
      type:   'Withdrawal',
      amount: -Number(w.amount), // negativo = saída
      status: w.status,
      paid_at: w.paid_at,
    }))

    const all = [...commissionItems, ...withdrawalItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const total = all.length
    const paginated = all.slice((page - 1) * perPage, page * perPage)

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

  // GET /mastersaas/me/payment-method — dados bancários atuais (mascarados)
  app.get('/payment-method', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId

    const { data: profile, error } = await supabaseAdmin()
      .from('profiles')
      .select('pix_key, bank_name, bank_agency, bank_account, payment_type')
      .eq('id', affiliateId)
      .single()

    if (error || !profile) return reply.code(404).send({ error: 'Perfil não encontrado' })

    // Mascara dados sensíveis
    const mask = (s: string | null) => s ? `${s.slice(0, 3)}***${s.slice(-2)}` : null

    return {
      payment_type:  profile.payment_type,
      pix_key:       mask(profile.pix_key),
      bank_name:     profile.bank_name,
      bank_agency:   profile.bank_agency,
      bank_account:  mask(profile.bank_account),
    }
  })

  // PUT /mastersaas/me/payment-method — atualiza dados bancários do afiliado
  app.put('/payment-method', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId

    const body = (request.body as any) ?? {}
    const allowed = ['pix_key', 'bank_name', 'bank_agency', 'bank_account', 'payment_type'] as const
    const update: Record<string, any> = {}
    for (const key of allowed) {
      if (key in body) update[key] = body[key]
    }

    if (!Object.keys(update).length) {
      return reply.code(400).send({ error: 'Nenhum campo válido para atualizar.' })
    }

    // Valida payment_type se fornecido
    if (update.payment_type && !['pix', 'bank', 'wise'].includes(update.payment_type)) {
      return reply.code(400).send({ error: 'payment_type deve ser pix, bank ou wise.' })
    }

    const { error } = await supabaseAdmin()
      .from('profiles')
      .update(update)
      .eq('id', affiliateId)

    if (error) return reply.code(500).send({ error: error.message })
    return { updated: true, fields: Object.keys(update) }
  })
}
