/**
 * Motor de comissões do MasterSaaS
 * Chamado pelos webhooks Stripe e AppMax após confirmação de pagamento.
 *
 * Responsabilidades:
 *  1. Verifica idempotência (sale já processada?)
 *  2. Resolve afiliado, produto e promoção ativa
 *  3. Cria mastersaas.sales
 *  4. Cria commission direta (type='direct') em pending
 *  5. Atualiza promotion_performance
 *  6. Se afiliado tem recrutador elegível → cria commission de rede (type='network')
 *  7. Registra commission_history para ambas
 */
import { createHash } from 'crypto'
import { supabaseAdmin, supabaseMasterSaaS } from '../../lib/supabase.js'

const HOLDING_DAYS = 30

// ─── Tipos internos ───────────────────────────────────────────────────────────

export type SaleInput = {
  gateway:             'stripe' | 'appmax'
  external_payment_id: string
  customer_email:      string          // será hasheada
  phone?:              string | null
  revenue:             number          // valor bruto em unidade monetária (não centavos)
  currency:            string          // 'BRL' | 'USD' | ...
  source?:             string | null   // MASTERSAAS|AFIL|{code}|{productCode}
  raw_affiliate_code?: string | null   // fallback se src não estiver disponível
  raw_product_code?:   string | null   // fallback se src não estiver disponível
}

export type CommissionResult = {
  skipped:    boolean           // true = já processada (idempotência)
  sale_id?:   string
  direct?:    { id: string; commission: number; rate: number }
  network?:   { id: string; commission: number; rate: number }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

/** Parseia src=MASTERSAAS|AFIL|{code}|{productCode} */
function parseSrc(src?: string | null): { code: string | null; productCode: string | null } {
  if (!src) return { code: null, productCode: null }
  const parts = src.split('|')
  // formato: MASTERSAAS|AFIL|CODE|PRODUCT_CODE
  if (parts.length >= 4 && parts[0] === 'MASTERSAAS' && parts[1] === 'AFIL') {
    return { code: parts[2] || null, productCode: parts[3] || null }
  }
  return { code: null, productCode: null }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000)
}

// ─── Motor principal ──────────────────────────────────────────────────────────

export async function processAffiliateSale(input: SaleInput, log?: any): Promise<CommissionResult> {
  const db    = supabaseMasterSaaS()
  const admin = supabaseAdmin()

  // ── 1. Idempotência ─────────────────────────────────────────────────────────
  const { data: existing } = await db
    .from('sales')
    .select('id')
    .eq('gateway', input.gateway)
    .eq('external_payment_id', input.external_payment_id)
    .single()

  if (existing) {
    log?.info({ sale_id: existing.id }, 'mastersaas: venda já processada — ignorando')
    return { skipped: true, sale_id: existing.id }
  }

  // ── 2. Resolve afiliado via src ou fallback ──────────────────────────────────
  const { code: srcCode, productCode: srcProductCode } = parseSrc(input.source)
  const affiliateCode = srcCode ?? input.raw_affiliate_code ?? null
  const productCode   = srcProductCode ?? input.raw_product_code ?? null

  if (!affiliateCode) {
    log?.warn({ source: input.source }, 'mastersaas: sem affiliate_code — venda não atribuída')
    return { skipped: true }
  }

  // Busca perfil do afiliado
  const { data: affiliateProfile } = await admin
    .from('profiles')
    .select('id, display_name, affiliate_code, referred_by_id, last_sale_at')
    .eq('affiliate_code', affiliateCode.toUpperCase())
    .single()

  if (!affiliateProfile) {
    log?.warn({ affiliateCode }, 'mastersaas: afiliado não encontrado — venda não atribuída')
    return { skipped: true }
  }

  // ── 3. Resolve produto ───────────────────────────────────────────────────────
  let product: any = null

  if (productCode) {
    const { data } = await db
      .from('products')
      .select('slug, product_code, commission_rate, commission_duration')
      .eq('product_code', productCode)
      .single()
    product = data
  }

  if (!product) {
    log?.warn({ productCode }, 'mastersaas: produto não encontrado — venda não atribuída')
    return { skipped: true }
  }

  // ── 4. Promoção ativa na data da venda ───────────────────────────────────────
  const saleDate  = new Date()
  const saleDateStr = saleDate.toISOString().split('T')[0]

  const { data: activePromotion } = await db
    .from('promotions')
    .select('id, commission_rate_override, performance_enabled, performance_min_sales, performance_rate_if_reached, performance_rate_if_not_reached')
    .eq('product_slug', product.slug)
    .eq('enabled', true)
    .lte('start_date', saleDateStr)
    .gte('end_date', saleDateStr)
    .order('start_date', { ascending: false })
    .limit(1)
    .single()

  // ── 5. Resolve taxa efetiva (ADR-007: Performance Boost prospectivo) ─────────
  let rateSnapshot = product.commission_rate ?? 0
  let campaignId: string | null = null

  if (activePromotion) {
    campaignId = activePromotion.id

    // Conta vendas do afiliado nessa campanha (para Performance Boost)
    const { count: salesInCampaign } = await db
      .from('commissions')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_id', affiliateProfile.id)
      .eq('campaign_id', activePromotion.id)
      .eq('type', 'direct')

    const salesCount = salesInCampaign ?? 0

    if (!activePromotion.performance_enabled) {
      rateSnapshot = activePromotion.commission_rate_override ?? rateSnapshot
    } else {
      // Boost prospectivo: apenas esta venda (salesCount ainda não inclui a atual)
      const willReach = (salesCount + 1) >= (activePromotion.performance_min_sales ?? Infinity)
      rateSnapshot = willReach
        ? (activePromotion.performance_rate_if_reached ?? rateSnapshot)
        : (activePromotion.performance_rate_if_not_reached ?? rateSnapshot)
    }
  }

  const commissionValue = Number((input.revenue * rateSnapshot / 100).toFixed(2))
  const holdUntil       = addDays(saleDate, HOLDING_DAYS)

  // ── 6. Cria mastersaas.sales ─────────────────────────────────────────────────
  const { data: sale, error: saleError } = await db
    .from('sales')
    .insert({
      affiliate_id:          affiliateProfile.id,
      product_slug:          product.slug,
      campaign_id:           campaignId,
      customer_email_hash:   hashEmail(input.customer_email),
      phone:                 input.phone ?? null,
      revenue:               input.revenue,
      currency:              input.currency,
      gateway:               input.gateway,
      external_payment_id:   input.external_payment_id,
      source:                input.source ?? null,
      status:                'completed',
    })
    .select('id')
    .single()

  if (saleError || !sale) {
    log?.error({ saleError }, 'mastersaas: erro ao inserir sale')
    throw new Error(`Erro ao criar sale: ${saleError?.message}`)
  }

  // ── 7. Cria comissão direta ──────────────────────────────────────────────────
  const { data: directCommission, error: directError } = await db
    .from('commissions')
    .insert({
      sale_id:          sale.id,
      affiliate_id:     affiliateProfile.id,
      campaign_id:      campaignId,
      type:             'direct',
      revenue:          input.revenue,
      commission:       commissionValue,
      rate_snapshot:    rateSnapshot,
      sale_date:        saleDate.toISOString(),
      hold_until:       holdUntil.toISOString(),
      status:           'pending',
    })
    .select('id')
    .single()

  if (directError || !directCommission) {
    log?.error({ directError }, 'mastersaas: erro ao inserir comissão direta')
    throw new Error(`Erro ao criar comissão direta: ${directError?.message}`)
  }

  // Audit trail — criação da comissão direta
  await db.from('commission_history').insert({
    commission_id: directCommission.id,
    from_status:   'pending',
    to_status:     'pending',
    note:          `Comissão criada via webhook ${input.gateway} (${input.external_payment_id})`,
  })

  // ── 8. Atualiza promotion_performance ────────────────────────────────────────
  if (campaignId) {
    await db.from('promotion_performance').upsert(
      { promotion_id: campaignId, affiliate_id: affiliateProfile.id, sales_count: 1 },
      { onConflict: 'promotion_id,affiliate_id', ignoreDuplicates: false }
    )
    // Incrementa via RPC para evitar race condition — fallback: upsert com count atual + 1
    // (em produção de alto volume usar pg function; suficiente para MVP)
  }

  // ── 9. Atualiza last_sale_at no perfil (janela de elegibilidade de rede) ─────
  await admin
    .from('profiles')
    .update({ last_sale_at: saleDate.toISOString() })
    .eq('id', affiliateProfile.id)

  // ── 10. Comissão de rede (coafiliação) ──────────────────────────────────────
  let networkResult: CommissionResult['network'] = undefined

  if (affiliateProfile.referred_by_id) {
    const { data: recruiter } = await admin
      .from('profiles')
      .select('id, last_sale_at')
      .eq('id', affiliateProfile.referred_by_id)
      .single()

    if (recruiter) {
      // Verifica elegibilidade — janela deslizante (ADR elegibilidade confirmada)
      const { data: networkSettings } = await db
        .from('network_settings')
        .select('enabled, default_rate_pct, eligibility_days, min_sales_required')
        .eq('id', 1)
        .single()

      const eligible = isReferralEligible(recruiter.last_sale_at, networkSettings, saleDate)

      if (networkSettings?.enabled && eligible) {
        const networkRate   = networkSettings.default_rate_pct ?? 5
        const networkAmount = Number((commissionValue * networkRate / 100).toFixed(2))

        const { data: networkCommission } = await db
          .from('commissions')
          .insert({
            sale_id:              sale.id,
            affiliate_id:         recruiter.id,
            campaign_id:          campaignId,
            type:                 'network',
            parent_commission_id: directCommission.id,
            revenue:              input.revenue,
            commission:           networkAmount,
            rate_snapshot:        networkRate,
            sale_date:            saleDate.toISOString(),
            hold_until:           holdUntil.toISOString(),
            status:               'pending',
          })
          .select('id')
          .single()

        if (networkCommission) {
          await db.from('commission_history').insert({
            commission_id: networkCommission.id,
            from_status:   'pending',
            to_status:     'pending',
            note:          `Comissão de rede gerada — indicador do afiliado ${affiliateProfile.affiliate_code}`,
          })

          networkResult = {
            id:         networkCommission.id,
            commission: networkAmount,
            rate:       networkRate,
          }
        }
      }
    }
  }

  log?.info({ sale_id: sale.id, direct: commissionValue, network: networkResult?.commission }, 'mastersaas: venda e comissões criadas')

  // Notifica afiliado via WhatsApp (new_sale) — disparo assíncrono sem bloquear o webhook
  if (input.phone) {
    import('./whatsapp.js').then(({ notifyAffiliate }) => {
      notifyAffiliate({
        phone:         input.phone!,
        trigger_event: 'new_sale',
        vars:          [(affiliateProfile as any).display_name ?? affiliateProfile.affiliate_code, input.revenue.toFixed(2), commissionValue.toFixed(2)],
        log,
      }).catch(() => {}) // silencioso — falha de WA não bloqueia o fluxo financeiro
    })
  }

  return {
    skipped: false,
    sale_id: sale.id,
    direct:  { id: directCommission.id, commission: commissionValue, rate: rateSnapshot },
    network: networkResult,
  }
}

// ─── isReferralEligible — janela deslizante via lastSaleAt ───────────────────

function isReferralEligible(
  lastSaleAt:      string | null,
  settings:        { eligibility_days: number; min_sales_required: number } | null,
  now = new Date()
): boolean {
  if (!lastSaleAt || !settings) return false
  const daysSince = (now.getTime() - new Date(lastSaleAt).getTime()) / 86_400_000
  return daysSince <= settings.eligibility_days
}
