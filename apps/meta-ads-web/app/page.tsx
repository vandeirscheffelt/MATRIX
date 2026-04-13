import { api } from '@/lib/api'
import { StatCard } from '@/components/campanhas/stat-card'
import { DashboardTable } from '@/components/campanhas/dashboard-table'
import { fmt } from '@/lib/utils'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function Dashboard() {
  const campanhas = await api.campanhas.list().catch(() => [])

  const ativas = campanhas.filter((c) => c.status === 'ativa').length
  const gastoTotal = campanhas.reduce((s, c) => s + (c.orcamento_total ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-xs text-muted mt-0.5">Visão geral das campanhas</p>
        </div>
        <Link
          href="/nova-campanha"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-accent text-bg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          <Plus size={14} />
          Nova Campanha
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Campanhas ativas" value={ativas} />
        <StatCard label="Total campanhas" value={campanhas.length} />
        <StatCard label="Orçamento total" value={fmt(gastoTotal, 'currency')} />
        <StatCard label="Aguardando config" value={campanhas.filter((c) => c.status === 'rascunho').length} />
      </div>

      {/* Tabela */}
      <div className="rounded-lg border border-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-sidebar text-left text-xs text-muted uppercase tracking-wide">
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Orçamento</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            <DashboardTable campanhas={campanhas} />
          </tbody>
        </table>
      </div>
    </div>
  )
}

