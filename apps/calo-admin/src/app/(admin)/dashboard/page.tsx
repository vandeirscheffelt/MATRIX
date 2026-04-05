'use client'

import { useEffect, useState } from 'react'
import { Bird, BookmarkCheck, ShoppingBag, TrendingUp } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { MetricCard } from '@/components/ui/MetricCard'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function DashboardPage() {
  const [birds, setBirds] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.birds.list({ limit: '100' }),
      api.orders.list({ limit: '5' }),
    ]).then(([b, o]) => {
      setBirds(b.data ?? [])
      setOrders(o.data ?? [])
    }).finally(() => setLoading(false))
  }, [])

  const available = birds.filter(b => b.status === 'available').length
  const reserved  = birds.filter(b => b.status === 'reserved').length
  const sold      = birds.filter(b => b.status === 'sold').length
  const openOrders = orders.filter((o: any) => ['pending', 'reserved'].includes(o.status)).length

  return (
    <div>
      <Header title="Dashboard" subtitle="Visão geral da operação" />

      <div className="p-6 space-y-6">
        {/* Métricas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Disponíveis" value={loading ? '—' : available} icon={Bird} color="green" />
          <MetricCard label="Reservados"  value={loading ? '—' : reserved}  icon={BookmarkCheck} color="yellow" />
          <MetricCard label="Vendidos"    value={loading ? '—' : sold}       icon={TrendingUp} color="gray" />
          <MetricCard label="Pedidos abertos" value={loading ? '—' : openOrders} icon={ShoppingBag} color="blue" />
        </div>

        {/* Pedidos recentes */}
        <div className="bg-bg-secondary border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-sm font-semibold text-text-primary">Pedidos recentes</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-text-secondary text-sm">Carregando...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-text-secondary text-sm">Nenhum pedido ainda.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Cliente', 'Total', 'Frete', 'Status', 'Data'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-text-muted font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-text-primary">{o.buyer?.company_name ?? '—'}</td>
                    <td className="px-5 py-3 text-text-primary">{formatCurrency(o.total_cents)}</td>
                    <td className="px-5 py-3 text-text-secondary">{formatCurrency(o.shipping_cents)}</td>
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3 text-text-secondary">{formatDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
