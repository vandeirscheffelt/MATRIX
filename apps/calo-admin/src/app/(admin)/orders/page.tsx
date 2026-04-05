'use client'

import { useEffect, useState } from 'react'
import { ShoppingBag, ExternalLink } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'

const STATUS_OPTIONS = ['pending', 'reserved', 'paid', 'shipped', 'cancelled']

export default function OrdersPage() {
  const { toast } = useToast()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [detail, setDetail] = useState<any>(null)
  const [newStatus, setNewStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    const params: any = {}
    if (statusFilter) params.status = statusFilter
    api.orders.list(params).then(r => setOrders(r.data ?? [])).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [statusFilter])

  const openDetail = async (id: string) => {
    const o = await api.orders.get(id)
    setDetail(o)
    setNewStatus(o.status)
  }

  const handleUpdateStatus = async () => {
    if (!detail || newStatus === detail.status) return
    setSaving(true)
    try {
      await api.orders.updateStatus(detail.id, newStatus)
      toast('Status atualizado!')
      setDetail(null)
      load()
    } catch (e: any) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <Header title="Pedidos" subtitle="Acompanhe vendas e pagamentos" />

      <div className="p-6 space-y-4">
        <div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-bg-secondary border border-white/[0.08] text-text-secondary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-accent/50">
            <option value="">Todos os status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="bg-bg-secondary border border-white/[0.06] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-text-secondary text-sm">Carregando...</div>
          ) : orders.length === 0 ? (
            <EmptyState icon={ShoppingBag} title="Nenhum pedido encontrado" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Cliente', 'Itens', 'Total', 'Frete', 'Distância', 'Status', 'Data', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-text-muted font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => (
                  <tr key={o.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-text-primary">{o.buyer?.company_name ?? '—'}</td>
                    <td className="px-5 py-3 text-text-secondary">{o.items?.length ?? 0} filhote(s)</td>
                    <td className="px-5 py-3 text-text-primary font-medium">{formatCurrency(o.total_cents)}</td>
                    <td className="px-5 py-3 text-text-secondary">{formatCurrency(o.shipping_cents)}</td>
                    <td className="px-5 py-3 text-text-secondary">{o.shipping_distance_km ? `${o.shipping_distance_km} km` : '—'}</td>
                    <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-5 py-3 text-text-secondary">{formatDate(o.created_at)}</td>
                    <td className="px-5 py-3">
                      <Button variant="ghost" size="sm" onClick={() => openDetail(o.id)}>
                        <ExternalLink size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal detalhe */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="Detalhe do pedido" size="md">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-text-muted">Cliente</p><p className="text-text-primary font-medium">{detail.buyer?.company_name}</p></div>
              <div><p className="text-text-muted">E-mail</p><p className="text-text-primary">{detail.buyer?.email}</p></div>
              <div><p className="text-text-muted">Total</p><p className="text-text-primary font-medium">{formatCurrency(detail.total_cents)}</p></div>
              <div><p className="text-text-muted">Frete</p><p className="text-text-primary">{formatCurrency(detail.shipping_cents)} · {detail.shipping_distance_km} km</p></div>
            </div>

            <div className="border-t border-white/[0.06] pt-4">
              <p className="text-xs text-text-muted mb-2">Filhotes</p>
              {detail.items?.map((item: any) => (
                <div key={item.chick?.id} className="flex justify-between text-sm py-1">
                  <span className="text-text-primary">{item.chick?.name ?? item.chick?.mutation}</span>
                  <span className="text-text-secondary">{formatCurrency(item.price_cents)}</span>
                </div>
              ))}
            </div>

            {detail.reservation && (
              <div className="border-t border-white/[0.06] pt-4 text-sm">
                <p className="text-xs text-text-muted mb-2">Reserva</p>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Sinal pago</span>
                  <span className="text-text-primary">{formatCurrency(detail.reservation.deposit_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Saldo restante</span>
                  <span className="text-yellow-400">{formatCurrency(detail.reservation.remaining_cents)}</span>
                </div>
              </div>
            )}

            <div className="border-t border-white/[0.06] pt-4">
              <p className="text-xs text-text-muted mb-2">Atualizar status</p>
              <div className="flex gap-3">
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="flex-1 bg-bg-primary border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50">
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <Button onClick={handleUpdateStatus} disabled={saving || newStatus === detail.status}>
                  {saving ? 'Salvando...' : 'Atualizar'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
