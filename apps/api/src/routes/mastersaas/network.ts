import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseAdmin, supabaseMasterSaaS } from '../../lib/supabase.js'
import { requireMSAuth, requireMSAdmin } from './auth-guard.js'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const networkSettingsBody = z.object({
  enabled:            z.boolean().optional(),
  default_rate_pct:   z.number().min(0).max(100).optional(),
  eligibility_days:   z.number().int().min(1).optional(),
  min_sales_required: z.number().int().min(1).optional(),
})

const networkCampaignBody = z.object({
  name:                       z.string().min(1),
  start_date:                 z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:                   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate_pct_override:          z.number().min(0).max(100).optional().nullable(),
  eligibility_days_override:  z.number().int().min(1).optional().nullable(),
  min_sales_override:         z.number().int().min(1).optional().nullable(),
  enabled:                    z.boolean().default(true),
}).refine(d => d.end_date >= d.start_date, {
  message: 'end_date deve ser igual ou posterior a start_date',
  path: ['end_date'],
})

const networkCampaignFields = z.object({
  name:                       z.string().min(1),
  start_date:                 z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:                   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rate_pct_override:          z.number().min(0).max(100).optional().nullable(),
  eligibility_days_override:  z.number().int().min(1).optional().nullable(),
  min_sales_override:         z.number().int().min(1).optional().nullable(),
  enabled:                    z.boolean().optional(),
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resolveCampaignStatus(c: { enabled: boolean; start_date: string; end_date: string }, now = new Date()) {
  if (!c.enabled) return 'disabled'
  const start = new Date(c.start_date)
  const end   = new Date(c.end_date + 'T23:59:59.999Z')
  if (now < start) return 'scheduled'
  if (now > end)   return 'expired'
  return 'active'
}

/** Resolve regras efetivas: base + override da campanha ativa */
async function resolveNetworkRules(db: ReturnType<typeof supabaseMasterSaaS>) {
  const { data: settings } = await db
    .from('network_settings')
    .select('*')
    .eq('id', 1)
    .single()

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const { data: campaigns } = await db
    .from('network_campaigns')
    .select('*')
    .eq('enabled', true)
    .lte('start_date', todayStr)
    .gte('end_date', todayStr)
    .order('start_date', { ascending: false })
    .limit(1)

  const activeCampaign = campaigns?.[0] ?? null

  const base = settings ?? { enabled: true, default_rate_pct: 5, eligibility_days: 30, min_sales_required: 1 }

  return {
    enabled:          base.enabled,
    rate_pct:         activeCampaign?.rate_pct_override        ?? base.default_rate_pct,
    eligibility_days: activeCampaign?.eligibility_days_override ?? base.eligibility_days,
    min_sales:        activeCampaign?.min_sales_override        ?? base.min_sales_required,
    from_campaign:    activeCampaign ?? null,
  }
}

/** Verifica elegibilidade — janela deslizante via last_sale_at */
function isEligible(lastSaleAt: string | null, eligibilityDays: number, now = new Date()): boolean {
  if (!lastSaleAt) return false
  const daysSince = (now.getTime() - new Date(lastSaleAt).getTime()) / 86_400_000
  return daysSince <= eligibilityDays
}

// ─── Rotas públicas / afiliado ────────────────────────────────────────────────

export async function msNetworkAffiliateRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()

  // GET /mastersaas/network/rules — regras resolvidas (público)
  app.get('/rules', async (_request, reply) => {
    const rules = await resolveNetworkRules(db)
    return rules
  })

  // GET /mastersaas/me/network/eligibility — elegibilidade do afiliado autenticado
  app.get('/eligibility', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId

    const { data: profile } = await supabaseAdmin()
      .from('profiles')
      .select('last_sale_at')
      .eq('id', affiliateId)
      .single()

    const rules = await resolveNetworkRules(db)

    if (!rules.enabled) {
      return { eligible: false, reason: 'Rede de coafiliação desabilitada pelo administrador.' }
    }

    const eligible = isEligible(profile?.last_sale_at ?? null, rules.eligibility_days)

    let reason: string | null = null
    if (!eligible) {
      if (!profile?.last_sale_at) {
        reason = `Faça ao menos ${rules.min_sales} venda(s) para ativar as comissões de rede.`
      } else {
        const daysSince = Math.floor((Date.now() - new Date(profile.last_sale_at).getTime()) / 86_400_000)
        const remaining = rules.eligibility_days - daysSince
        reason = `Sua última venda foi há ${daysSince} dias. Venda novamente nos próximos ${remaining > 0 ? remaining : 0} dia(s) para manter a elegibilidade.`
      }
    }

    return {
      eligible,
      reason,
      last_sale_at:     profile?.last_sale_at ?? null,
      eligibility_days: rules.eligibility_days,
      network_rate_pct: rules.rate_pct,
      active_campaign:  rules.from_campaign ? {
        name:          rules.from_campaign.name,
        end_date:      rules.from_campaign.end_date,
        rate_override: rules.from_campaign.rate_pct_override,
      } : null,
    }
  })

  // GET /mastersaas/me/network/link — link de recrutamento do afiliado
  app.get('/link', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId

    const { data: profile } = await supabaseAdmin()
      .from('profiles')
      .select('affiliate_code')
      .eq('id', affiliateId)
      .single()

    if (!profile) return reply.code(404).send({ error: 'Perfil não encontrado' })

    const baseUrl = process.env.MASTERSAAS_FRONTEND_URL ?? 'https://mastersaas.scheffelt.xyz'
    const apiUrl  = process.env.API_URL ?? 'https://api.shaikron.scheffelt.xyz'

    return {
      join_link:     `${baseUrl}/join/${profile.affiliate_code}`,
      referral_link: `${apiUrl}/mastersaas/r/${profile.affiliate_code}`,
      affiliate_code: profile.affiliate_code,
    }
  })

  // GET /mastersaas/me/network/referrals — lista de coafiliados do afiliado
  app.get('/referrals', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId

    // Busca perfis indicados por este afiliado
    const { data: referrals, error } = await supabaseAdmin()
      .from('profiles')
      .select('id, display_name, affiliate_code, created_at')
      .eq('referred_by_id', affiliateId)
      .order('created_at', { ascending: false })

    if (error) return reply.code(500).send({ error: error.message })
    if (!referrals?.length) return { data: [], totals: { referrals: 0, lifetime_earnings: 0, month_earnings: 0 } }

    const referralIds = referrals.map((r: any) => r.id)

    // Busca comissões de rede geradas por esses indicados
    const { data: networkCommissions } = await db
      .from('commissions')
      .select('affiliate_id, commission, status, sale_date, created_at')
      .eq('affiliate_id', affiliateId)
      .eq('type', 'network')

    // Busca comissões diretas dos indicados (para saber quais são ativos)
    const { data: referralSales } = await db
      .from('commissions')
      .select('affiliate_id, commission, sale_date')
      .in('affiliate_id', referralIds)
      .eq('type', 'direct')
      .not('status', 'in', '("canceled","refunded")')

    const now          = new Date()
    const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    // Agrega métricas por indicado
    const enriched = referrals.map((r: any) => {
      const myEarnings = (networkCommissions ?? []).filter((c: any) => {
        // Não existe um campo direto — inferimos via parent_commission_id
        // mas por simplicidade usamos o que temos: comissões de rede do afiliado
        return true // todas as comissões de rede pertencem ao afiliado, não ao indicado
      })

      const theirSales = (referralSales ?? []).filter((s: any) => s.affiliate_id === r.id)
      const theirSalesCount  = theirSales.length
      const lastSaleAt       = theirSales.sort((a: any, b: any) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime())[0]?.sale_date ?? null

      return {
        id:              r.id,
        display_name:    r.display_name,
        affiliate_code:  r.affiliate_code,
        joined_at:       r.created_at,
        sales_count:     theirSalesCount,
        last_sale_at:    lastSaleAt,
        is_active:       lastSaleAt ? (Date.now() - new Date(lastSaleAt).getTime()) / 86_400_000 <= 30 : false,
      }
    })

    // Totais das comissões de rede do afiliado autenticado
    const nc = networkCommissions ?? []
    const lifetimeEarnings = Number(nc.filter((c: any) => !['canceled','refunded'].includes(c.status)).reduce((s: number, c: any) => s + Number(c.commission), 0).toFixed(2))
    const monthEarnings    = Number(nc.filter((c: any) => c.created_at >= monthStart && !['canceled','refunded'].includes(c.status)).reduce((s: number, c: any) => s + Number(c.commission), 0).toFixed(2))

    return {
      data: enriched,
      totals: {
        referrals:         referrals.length,
        active_referrals:  enriched.filter((r: any) => r.is_active).length,
        lifetime_earnings: lifetimeEarnings,
        month_earnings:    monthEarnings,
      },
    }
  })

  // GET /mastersaas/me/network/referrals/export — CSV
  app.get('/referrals/export', { preHandler: [requireMSAuth] }, async (request, reply) => {
    const affiliateId = (request as any).msUserId

    const { data: referrals } = await supabaseAdmin()
      .from('profiles')
      .select('display_name, affiliate_code, created_at')
      .eq('referred_by_id', affiliateId)
      .order('created_at', { ascending: false })

    const rows = (referrals ?? []).map((r: any) => [
      r.display_name ?? '',
      r.affiliate_code,
      r.created_at,
    ])

    const csv = [
      ['Nome', 'Código', 'Data de entrada'].join(','),
      ...rows.map((r: any[]) => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="coafiliados.csv"')
    return reply.send(csv)
  })
}

// ─── Rotas admin ──────────────────────────────────────────────────────────────

export async function msNetworkAdminRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()
  const preHandler = [requireMSAuth, requireMSAdmin]

  // GET /mastersaas/admin/network/settings
  app.get('/settings', { preHandler }, async (_request, reply) => {
    const { data, error } = await db
      .from('network_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // PATCH /mastersaas/admin/network/settings
  app.patch('/settings', { preHandler }, async (request, reply) => {
    const body = networkSettingsBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await db
      .from('network_settings')
      .update({ ...body.data, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return data
  })

  // GET /mastersaas/admin/network/settings/resolved — regras efetivas agora
  app.get('/settings/resolved', { preHandler }, async (_request, reply) => {
    return resolveNetworkRules(db)
  })

  // GET /mastersaas/admin/network/campaigns
  app.get('/campaigns', { preHandler }, async (_request, reply) => {
    const { data, error } = await db
      .from('network_campaigns')
      .select('*')
      .order('start_date', { ascending: false })

    if (error) return reply.code(500).send({ error: error.message })

    const enriched = (data ?? []).map(c => ({
      ...c,
      status: resolveCampaignStatus(c),
    }))

    return { data: enriched }
  })

  // POST /mastersaas/admin/network/campaigns
  app.post('/campaigns', { preHandler }, async (request, reply) => {
    const body = networkCampaignBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await db
      .from('network_campaigns')
      .insert(body.data)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send({ ...data, status: resolveCampaignStatus(data) })
  })

  // PATCH /mastersaas/admin/network/campaigns/:id
  app.patch<{ Params: { id: string } }>('/campaigns/:id', { preHandler }, async (request, reply) => {
    const body = networkCampaignFields.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data: existing } = await db
      .from('network_campaigns')
      .select('id, start_date, end_date')
      .eq('id', request.params.id)
      .single()

    if (!existing) return reply.code(404).send({ error: 'Campanha não encontrada' })

    const merged = { ...existing, ...body.data }
    if (merged.end_date < merged.start_date) {
      return reply.code(400).send({ error: 'end_date deve ser igual ou posterior a start_date' })
    }

    const { data, error } = await db
      .from('network_campaigns')
      .update({ ...body.data, updated_at: new Date().toISOString() })
      .eq('id', request.params.id)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return { ...data, status: resolveCampaignStatus(data) }
  })

  // PATCH /mastersaas/admin/network/campaigns/:id/toggle
  app.patch<{ Params: { id: string } }>('/campaigns/:id/toggle', { preHandler }, async (request, reply) => {
    const { data: existing } = await db
      .from('network_campaigns')
      .select('id, enabled')
      .eq('id', request.params.id)
      .single()

    if (!existing) return reply.code(404).send({ error: 'Campanha não encontrada' })

    const { data, error } = await db
      .from('network_campaigns')
      .update({ enabled: !existing.enabled, updated_at: new Date().toISOString() })
      .eq('id', request.params.id)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return { id: data.id, enabled: data.enabled, status: resolveCampaignStatus(data) }
  })

  // DELETE /mastersaas/admin/network/campaigns/:id
  app.delete<{ Params: { id: string } }>('/campaigns/:id', { preHandler }, async (request, reply) => {
    const { data: existing } = await db
      .from('network_campaigns')
      .select('id')
      .eq('id', request.params.id)
      .single()

    if (!existing) return reply.code(404).send({ error: 'Campanha não encontrada' })

    const { error } = await db
      .from('network_campaigns')
      .delete()
      .eq('id', request.params.id)

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })
}
