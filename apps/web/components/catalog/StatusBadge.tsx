const config: Record<string, { label: string; className: string }> = {
  available: { label: 'Disponível', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  reserved:  { label: 'Reservado',  className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  sold:      { label: 'Vendido',    className: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30' },
}

export function StatusBadge({ status }: { status: string }) {
  const { label, className } = config[status] ?? config.available
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${className}`}>
      {label}
    </span>
  )
}
