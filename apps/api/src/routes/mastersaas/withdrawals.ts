import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseAdmin, supabaseMasterSaaS } from '../../lib/supabase.js'
// notifyAffiliate importado dinamicamente para evitar dependência circular
import { requireMSAuth, requireMSAdmin } from './auth-guard.js'

const MIN_WITHDRAWAL = 100 // R$100

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createWithdrawalBody = z.object({
  amount:           z.number().min(MIN_WITHDRAWAL, `Valor mínimo para saque é R$${MIN_WITHDRAWAL}`),
  idempotency_key:  z.string().uuid('idempotency_key deve ser um UUID v4'),
})

const updateStatusBody = z.object({
  status:     z.enum(['processing', 'paid', 'failed', 'canceled']),
  note:       z.string().optional(),
  payment_id: z.string().optional(), // ID da transferência PIX (obrigatório ao marcar como paid)
})

const VALID_TRANSITIONS: Record<string, string[]> = {
  requested:  ['processing', 'canceled'],
  processing: ['paid', 'failed', 'canceled'],
  failed:     ['processing'],
  paid:       [],
  canceled:   [],
}

// ─── Rotas do afiliado ────────────────────────────────────────────────────────

export async function msWithdrawalsAffiliateRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()

  // GET /mastersaas/me/withdrawals — lista saques do afiliado autenticado
  app.get('/', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId

    const { data, error } = await db
      .from('withdrawals')
      .select('id, amount, currency, status, payment_method_snapshot, payment_id, notes, batch_id, idempotency_key, requested_at, processed_at, paid_at')
      .eq('affiliate_id', affiliateId)
      .order('requested_at', { ascending: false })

    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // POST /mastersaas/me/withdrawals — solicita saque
  app.post('/', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId

    const body = createWithdrawalBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { amount, idempotency_key } = body.data

    // ── Idempotência: retorna withdrawal existente se já processado ──────────
    const { data: existing } = await db
      .from('withdrawals')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .eq('idempotency_key', idempotency_key)
      .single()

    if (existing) return existing

    // ── Verifica se já há saque pendente (requested ou processing) ───────────
    const { count: pendingCount } = await db
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_id', affiliateId)
      .in('status', ['requested', 'processing'])

    if ((pendingCount ?? 0) > 0) {
      return reply.code(409).send({ error: 'Você já possui um saque em andamento. Aguarde a conclusão antes de solicitar outro.' })
    }

    // ── Calcula saldo disponível (server-side — fonte de verdade) ────────────
    const { data: commissions } = await db
      .from('commissions')
      .select('commission')
      .eq('affiliate_id', affiliateId)
      .eq('status', 'available')

    const { data: processingWithdrawals } = await db
      .from('withdrawals')
      .select('amount')
      .eq('affiliate_id', affiliateId)
      .in('status', ['processing', 'paid'])

    const totalAvailable = (commissions ?? []).reduce((s: number, c: any) => s + Number(c.commission), 0)
    const totalWithdrawn = (processingWithdrawals ?? []).reduce((s: number, w: any) => s + Number(w.amount), 0)
    const availableBalance = Number((totalAvailable - totalWithdrawn).toFixed(2))

    if (amount > availableBalance) {
      return reply.code(422).send({
        error: `Saldo insuficiente. Disponível: R$${availableBalance.toFixed(2)}, solicitado: R$${amount.toFixed(2)}.`,
        available_balance: availableBalance,
      })
    }

    // ── Snapshot dos dados bancários atuais do perfil ────────────────────────
    const { data: profile } = await supabaseAdmin()
      .from('profiles')
      .select('pix_key, bank_name, bank_agency, bank_account, payment_type')
      .eq('id', affiliateId)
      .single()

    if (!profile?.pix_key && !profile?.bank_account) {
      return reply.code(422).send({ error: 'Cadastre seus dados bancários (PIX ou conta) antes de solicitar o saque.' })
    }

    const paymentSnapshot = {
      type:         profile.payment_type ?? 'pix',
      pix_key:      profile.pix_key ?? null,
      bank_name:    profile.bank_name ?? null,
      bank_agency:  profile.bank_agency ?? null,
      bank_account: profile.bank_account ?? null,
    }

    // ── Cria o saque ─────────────────────────────────────────────────────────
    const { data: withdrawal, error } = await db
      .from('withdrawals')
      .insert({
        affiliate_id:             affiliateId,
        amount,
        currency:                 'BRL',
        status:                   'requested',
        payment_method_snapshot:  paymentSnapshot,
        idempotency_key,
        requested_at:             new Date().toISOString(),
      })
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(withdrawal)
  })

  // DELETE /mastersaas/me/withdrawals/:id — afiliado cancela saque (apenas requested)
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireMSAuth] },
    async (request, reply) => {
      const affiliateId = (request as any).msUserId

      const { data: withdrawal } = await db
        .from('withdrawals')
        .select('id, status, affiliate_id')
        .eq('id', request.params.id)
        .single()

      if (!withdrawal) return reply.code(404).send({ error: 'Saque não encontrado' })
      if (withdrawal.affiliate_id !== affiliateId) return reply.code(403).send({ error: 'Acesso negado' })
      if (withdrawal.status !== 'requested') {
        return reply.code(409).send({ error: `Saque em status '${withdrawal.status}' não pode ser cancelado pelo afiliado.` })
      }

      const { data, error } = await db
        .from('withdrawals')
        .update({ status: 'canceled' })
        .eq('id', request.params.id)
        .select('id, status')
        .single()

      if (error) return reply.code(500).send({ error: error.message })
      return data
    }
  )
}

// ─── Rotas admin ──────────────────────────────────────────────────────────────

export async function msWithdrawalsAdminRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()
  const preHandler = [requireMSAuth, requireMSAdmin]

  // GET /mastersaas/admin/withdrawals — lista todos os saques
  app.get<{ Querystring: { status?: string; affiliate_id?: string } }>(
    '/',
    { preHandler },
    async (request, reply) => {
      let q = db
        .from('withdrawals')
        .select('*, profiles:affiliate_id(id, display_name, affiliate_code)')

      if (request.query.status)       q = q.eq('status', request.query.status)
      if (request.query.affiliate_id) q = q.eq('affiliate_id', request.query.affiliate_id)

      const { data, error } = await q.order('requested_at', { ascending: false })
      if (error) return reply.code(500).send({ error: error.message })
      return { data }
    }
  )

  // PATCH /mastersaas/admin/withdrawals/:id/status — atualiza status (admin)
  app.patch<{ Params: { id: string } }>(
    '/:id/status',
    { preHandler },
    async (request, reply) => {
      const body = updateStatusBody.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const { status: newStatus, note, payment_id } = body.data

      const { data: withdrawal } = await db
        .from('withdrawals')
        .select('id, status, affiliate_id, amount')
        .eq('id', request.params.id)
        .single()

      if (!withdrawal) return reply.code(404).send({ error: 'Saque não encontrado' })

      // Valida transição
      const allowed = VALID_TRANSITIONS[withdrawal.status] ?? []
      if (!allowed.includes(newStatus)) {
        return reply.code(409).send({
          error: `Transição '${withdrawal.status}' → '${newStatus}' não é permitida.`,
          valid_transitions: allowed,
        })
      }

      // payment_id obrigatório ao marcar como paid
      if (newStatus === 'paid' && !payment_id) {
        return reply.code(400).send({ error: 'payment_id é obrigatório ao marcar como paid (ID da transferência PIX).' })
      }

      const updateData: Record<string, any> = { status: newStatus }
      if (note)       updateData.notes        = note
      if (payment_id) updateData.payment_id   = payment_id
      if (newStatus === 'processing') updateData.processed_at = new Date().toISOString()
      if (newStatus === 'paid')       updateData.paid_at      = new Date().toISOString()

      const { data, error } = await db
        .from('withdrawals')
        .update(updateData)
        .eq('id', request.params.id)
        .select()
        .single()

      if (error) return reply.code(500).send({ error: error.message })

      // Notifica afiliado via WhatsApp nos eventos de aprovação e rejeição
      if (newStatus === 'processing' || newStatus === 'canceled') {
        const triggerEvent = newStatus === 'processing' ? 'withdrawal_approved' : 'withdrawal_rejected'
        const { data: profile } = await supabaseAdmin()
          .from('profiles')
          .select('display_name, pix_key')
          .eq('id', withdrawal.affiliate_id)
          .single()

        // Busca telefone do afiliado (salvo na última venda)
        // Se não disponível, notificação silenciosa
        import('./whatsapp.js').then(({ notifyAffiliate }) => {
          notifyAffiliate({
            phone:         (profile as any)?.phone ?? '',
            trigger_event: triggerEvent,
            vars:          [
              (profile as any)?.display_name ?? 'Afiliado',
              Number(withdrawal.amount).toFixed(2),
            ],
          }).catch(() => {})
        })
      }

      return data
    }
  )

  // POST /mastersaas/admin/payout-batches — processa múltiplos saques em lote
  app.post(
    '/payout-batches',
    { preHandler },
    async (request, reply) => {
      const body = z.object({
        withdrawal_ids: z.array(z.string().uuid()).min(1).max(50, 'Máximo de 50 saques por lote'),
      }).safeParse(request.body)

      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const { withdrawal_ids } = body.data
      const adminId = (request as any).msUserId

      // Busca apenas os saques com status 'requested' dentro dos IDs fornecidos
      const { data: eligibleWithdrawals, error: fetchError } = await db
        .from('withdrawals')
        .select('id, amount, affiliate_id')
        .in('id', withdrawal_ids)
        .eq('status', 'requested')

      if (fetchError) return reply.code(500).send({ error: fetchError.message })
      if (!eligibleWithdrawals?.length) {
        return reply.code(422).send({ error: 'Nenhum saque elegível encontrado. Verifique se os IDs estão em status requested.' })
      }

      const totalAmount = eligibleWithdrawals.reduce((s: number, w: any) => s + Number(w.amount), 0)
      const ids = eligibleWithdrawals.map((w: any) => w.id)

      // Cria o payout batch
      const { data: batch, error: batchError } = await db
        .from('payout_batches')
        .insert({
          created_by_admin_id: adminId,
          total_amount:        Number(totalAmount.toFixed(2)),
          currency:            'BRL',
          item_count:          ids.length,
          status:              'processing',
        })
        .select('id')
        .single()

      if (batchError || !batch) return reply.code(500).send({ error: batchError?.message })

      // Move saques para processing vinculados ao batch
      const { error: updateError } = await db
        .from('withdrawals')
        .update({
          status:       'processing',
          batch_id:     batch.id,
          processed_at: new Date().toISOString(),
        })
        .in('id', ids)
        .eq('status', 'requested') // guard extra: não sobrescreve status diferente

      if (updateError) return reply.code(500).send({ error: updateError.message })

      return reply.code(201).send({
        batch_id:          batch.id,
        item_count:        ids.length,
        total_amount:      totalAmount,
        withdrawal_ids:    ids,
        skipped_ids:       withdrawal_ids.filter(id => !ids.includes(id)),
      })
    }
  )
}
