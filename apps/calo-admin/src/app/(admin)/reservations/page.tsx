'use client'

import { useEffect, useState } from 'react'
import { BookmarkCheck, AlertTriangle } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { api } from '@/lib/api'
import { formatCurrency, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

export default function ReservationsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.orders.list({ status: 'reserved', limit: '50' })
      .then(r => setOrders(r.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  const isExpiringSoon = (expires: string) => {
    if (!expires) return false
    const diff = new Date(expires).getTime() - Date.now()
    return diff > 0 && diff < 24 * 60 * 60 * 1000
  }

  return (
    <div>
      <Header title="Reservas" subtitle="Pedidos com sinal — acompanhe vencimentos" />

      <div className="p-6">
        <div className="bg-bg-secondary border border-white/[0.06] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-text-secondary text-sm">Carregando...</div>
          ) : orders.length === 0 ? (
            <EmptyState icon={BookmarkCheck} title="Nenhuma reserva ativa" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {['Cliente', 'Filhote(s)', 'Sinal pago', 'Saldo restante', 'Expira em', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs text-text-muted font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => {
                  const res = o.reservation
                  const expiring = res?.expires_at && isExpiringSoon(res.expires_at)
                  return (
                    <tr key={o.id} className={cn(
                      'border-b border-white/[0.04] transition-colors',
                      expiring ? 'bg-yellow-400/[0.03] hover:bg-yellow-400/[0.06]' : 'hover:bg-white/[0.02]'
                    )}>
                      <td className="px-5 py-3 text-text-primary">{o.buyer?.company_name ?? '—'}</td>
                      <td className="px-5 py-3 text-text-secondary">
                        {o.items?.map((i: any) => i.chick?.mutation).join(', ') ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-text-primary">{res ? formatCurrency(res.deposit_cents) : '—'}</td>
                      <td className="px-5 py-3 text-yellow-400 font-medium">{res ? formatCurrency(res.remaining_cents) : '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {expiring && <AlertTriangle size={14} className="text-yellow-400" />}
                          <span className={cn('text-sm', expiring ? 'text-yellow-400 font-medium' : 'text-text-secondary')}>
                            {res?.expires_at ? formatDate(res.expires_at) : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
