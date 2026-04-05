import { cn } from '@/lib/utils'

const map: Record<string, { label: string; class: string }> = {
  available: { label: 'Disponível', class: 'bg-green-400/10 text-green-400' },
  reserved:  { label: 'Reservado',  class: 'bg-yellow-400/10 text-yellow-400' },
  sold:      { label: 'Vendido',    class: 'bg-slate-400/10 text-slate-400' },
  pending:   { label: 'Pendente',   class: 'bg-yellow-400/10 text-yellow-400' },
  paid:      { label: 'Pago',       class: 'bg-green-400/10 text-green-400' },
  shipped:   { label: 'Enviado',    class: 'bg-accent/10 text-accent' },
  cancelled: { label: 'Cancelado',  class: 'bg-red-400/10 text-red-400' },
  male:      { label: 'Macho',      class: 'bg-blue-400/10 text-blue-400' },
  female:    { label: 'Fêmea',      class: 'bg-pink-400/10 text-pink-400' },
  unknown:   { label: 'Indefinido', class: 'bg-slate-400/10 text-slate-400' },
}

export function StatusBadge({ status }: { status: string }) {
  const s = map[status] ?? { label: status, class: 'bg-white/10 text-white' }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium', s.class)}>
      {s.label}
    </span>
  )
}
