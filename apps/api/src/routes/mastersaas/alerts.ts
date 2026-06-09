import type { FastifyInstance } from 'fastify'
import { supabaseMasterSaaS } from '../../lib/supabase.js'
import { requireMSAuth } from './auth-guard.js'

type AlertScope    = 'global' | 'campaigns' | 'finance' | 'reports'
type AlertSeverity = 'info' | 'success' | 'warning' | 'danger'

interface SmartAlert {
  id:          string
  scope:       AlertScope
  severity:    AlertSeverity
  title:       string
  description: string
  action?:     { label: string; to: string }
  created_at:  string
}

const SEVERITY_ORDER: Record<AlertSeverity, number> = { danger: 0, warning: 1, success: 2, info: 3 }

function sortAlerts(alerts: SmartAlert[]): SmartAlert[] {
  return alerts.sort((a, b) => {
    const sv = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    if (sv !== 0) return sv
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export async function msAlertsRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()

  // GET /mastersaas/me/alerts?scope=
  // Alertas calculados em runtime a partir dos dados reais do afiliado.
  // IDs determinísticos — mesma condição não gera duplicata.
  app.get<{ Querystring: { scope?: string } }>(
    '/',
    { preHandler: [requireMSAuth] },
    async (request, reply) => {
      const affiliateId  = (request as any).msUserId
      const scopeFilter  = request.query.scope as AlertScope | undefined
      const now          = new Date()
      const alerts: SmartAlert[] = []

      // ── Dados base ──────────────────────────────────────────────────────────
      const [commissionsRes, withdrawalsRes, promotionsRes] = await Promise.all([
        db.from('commissions').select('commission, status, sale_date').eq('affiliate_id', affiliateId),
        db.from('withdrawals').select('amount, status').eq('affiliate_id', affiliateId),
        db.from('promotions').select('id, name, end_date, enabled, start_date').eq('enabled', true),
      ])

      const commissions  = commissionsRes.data  ?? []
      const withdrawals  = withdrawalsRes.data  ?? []
      const promotions   = promotionsRes.data   ?? []

      // ── 1. Saldo disponível para saque ──────────────────────────────────────
      const available = commissions
        .filter((c: any) => c.status === 'available')
        .reduce((s: number, c: any) => s + Number(c.commission), 0)

      const inFlight = withdrawals
        .filter((w: any) => w.status === 'processing')
        .reduce((s: number, w: any) => s + Number(w.amount), 0)

      const availableBalance = available - inFlight

      if (availableBalance >= 100) {
        alerts.push({
          id:          `payout-available-${Math.floor(availableBalance)}`,
          scope:       'finance',
          severity:    'success',
          title:       'Saldo disponível para saque',
          description: `Você tem R$ ${availableBalance.toFixed(2)} disponíveis para saque.`,
          action:      { label: 'Sacar agora', to: '/finance' },
          created_at:  now.toISOString(),
        })
      }

      // ── 2. Spike de vendas (±15% entre metades do período) ──────────────────
      const recentSales = commissions
        .filter((c: any) => c.type !== 'network' && !['canceled','refunded'].includes(c.status))
        .sort((a: any, b: any) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime())
        .slice(0, 20) // últimas 20 vendas

      if (recentSales.length >= 4) {
        const half   = Math.floor(recentSales.length / 2)
        const newer  = recentSales.slice(0, half).reduce((s: number, c: any) => s + Number(c.commission), 0)
        const older  = recentSales.slice(half).reduce((s: number, c: any) => s + Number(c.commission), 0)

        if (older > 0) {
          const change = (newer - older) / older
          if (change >= 0.15) {
            alerts.push({
              id:          'sales-spike-up',
              scope:       'reports',
              severity:    'success',
              title:       'Suas vendas estão crescendo',
              description: `Suas comissões recentes cresceram ${Math.round(change * 100)}% em relação ao período anterior.`,
              action:      { label: 'Ver relatório', to: '/sales' },
              created_at:  now.toISOString(),
            })
          } else if (change <= -0.15) {
            alerts.push({
              id:          'sales-drop',
              scope:       'reports',
              severity:    'warning',
              title:       'Queda nas suas vendas',
              description: `Suas comissões recentes caíram ${Math.round(Math.abs(change) * 100)}% em relação ao período anterior.`,
              action:      { label: 'Ver relatório', to: '/sales' },
              created_at:  now.toISOString(),
            })
          }
        }
      }

      // ── 3. Campanhas expirando em ≤ 3 dias ──────────────────────────────────
      const todayStr = now.toISOString().split('T')[0]

      for (const promo of promotions) {
        const end      = new Date(promo.end_date + 'T23:59:59.999Z')
        const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000)

        if (daysLeft >= 0 && daysLeft <= 3 && promo.start_date <= todayStr) {
          alerts.push({
            id:          `campaign-ending-${promo.id}`,
            scope:       'campaigns',
            severity:    'warning',
            title:       `Campanha "${promo.name}" encerrando`,
            description: daysLeft === 0
              ? 'Esta campanha encerra hoje!'
              : `Esta campanha encerra em ${daysLeft} dia(s). Aproveite a taxa especial.`,
            action:      { label: 'Ver campanhas', to: '/promotions' },
            created_at:  now.toISOString(),
          })
        }
      }

      // ── 4. Comissão pendente de liberação (holding quase vencendo) ───────────
      const pendingCommissions = commissions.filter((c: any) => c.status === 'pending')
      const totalPending = pendingCommissions.reduce((s: number, c: any) => s + Number(c.commission), 0)

      if (totalPending > 0) {
        alerts.push({
          id:          `pending-holding-${Math.floor(totalPending)}`,
          scope:       'finance',
          severity:    'info',
          title:       'Comissões em período de holding',
          description: `R$ ${totalPending.toFixed(2)} em comissões serão liberadas nos próximos 30 dias.`,
          action:      { label: 'Ver comissões', to: '/finance' },
          created_at:  now.toISOString(),
        })
      }

      // ── 5. Saque rejeitado pendente de ação ─────────────────────────────────
      const failedWithdrawals = withdrawals.filter((w: any) => w.status === 'failed')
      if (failedWithdrawals.length > 0) {
        alerts.push({
          id:          'withdrawal-failed',
          scope:       'finance',
          severity:    'danger',
          title:       'Saque com falha no pagamento',
          description: `${failedWithdrawals.length} saque(s) falharam. Verifique seus dados bancários e contate o suporte.`,
          action:      { label: 'Ver saques', to: '/finance' },
          created_at:  now.toISOString(),
        })
      }

      // ── Filtro de scope + ordenação ──────────────────────────────────────────
      const filtered = scopeFilter
        ? alerts.filter(a => a.scope === scopeFilter)
        : alerts

      return { data: sortAlerts(filtered) }
    }
  )

  // GET /mastersaas/admin/alerts — alertas globais da plataforma (admin)
  app.get(
    '/admin',
    { preHandler: [requireMSAuth] },
    async (request, reply) => {
      const now    = new Date()
      const alerts: SmartAlert[] = []

      const [allCommissions, promotionsRes] = await Promise.all([
        db.from('commissions').select('affiliate_id, commission, status, sale_date, type'),
        db.from('promotions').select('id, name, end_date, enabled, start_date').eq('enabled', true),
      ])

      const commissions = allCommissions.data ?? []
      const promotions  = promotionsRes.data  ?? []

      // ── Concentração: afiliado com >= 25% da receita recente ──────────────
      const recentDirect = commissions.filter((c: any) => c.type === 'direct' && !['canceled','refunded'].includes(c.status))
      const totalRevenue = recentDirect.reduce((s: number, c: any) => s + Number(c.commission), 0)

      if (totalRevenue > 0) {
        const byAffiliate: Record<string, number> = {}
        for (const c of recentDirect) {
          byAffiliate[c.affiliate_id] = (byAffiliate[c.affiliate_id] ?? 0) + Number(c.commission)
        }
        for (const [id, amount] of Object.entries(byAffiliate)) {
          const share = amount / totalRevenue
          if (share >= 0.25) {
            alerts.push({
              id:          `top-affiliate-concentration-${id}`,
              scope:       'global',
              severity:    'warning',
              title:       'Concentração de receita em afiliado',
              description: `Um afiliado representa ${Math.round(share * 100)}% da receita total. Diversifique a base de afiliados.`,
              action:      { label: 'Ver afiliados', to: '/admin/finance' },
              created_at:  now.toISOString(),
            })
          }
        }
      }

      // ── Campanhas expirando ──────────────────────────────────────────────
      const todayStr = now.toISOString().split('T')[0]
      for (const promo of promotions) {
        const end      = new Date(promo.end_date + 'T23:59:59.999Z')
        const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86_400_000)
        if (daysLeft >= 0 && daysLeft <= 3 && promo.start_date <= todayStr) {
          alerts.push({
            id:          `admin-campaign-ending-${promo.id}`,
            scope:       'campaigns',
            severity:    'warning',
            title:       `Campanha "${promo.name}" encerrando em ${daysLeft}d`,
            description: 'Considere criar uma nova campanha para manter o engajamento dos afiliados.',
            action:      { label: 'Gerenciar campanhas', to: '/admin/promotions' },
            created_at:  now.toISOString(),
          })
        }
      }

      // ── Comissões travadas em processing > 7 dias ──────────────────────
      const stuckProcessing = commissions.filter((c: any) => {
        if (c.status !== 'processing') return false
        const days = (now.getTime() - new Date(c.sale_date).getTime()) / 86_400_000
        return days > 7
      })

      if (stuckProcessing.length > 0) {
        alerts.push({
          id:          `stuck-processing-${stuckProcessing.length}`,
          scope:       'finance',
          severity:    'danger',
          title:       'Comissões travadas em processamento',
          description: `${stuckProcessing.length} comissão(ões) estão em "processing" há mais de 7 dias. Verifique o provedor de pagamento.`,
          action:      { label: 'Ver comissões', to: '/admin/finance/commissions' },
          created_at:  now.toISOString(),
        })
      }

      return { data: sortAlerts(alerts) }
    }
  )
}
