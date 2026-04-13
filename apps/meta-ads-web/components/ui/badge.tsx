'use client'
import { cn } from '@/lib/utils'

const variants: Record<string, string> = {
  ativa:     'bg-success/20 text-success border-success/30',
  pausada:   'bg-warning/20 text-warning border-warning/30',
  rascunho:  'bg-muted/20 text-muted border-muted/30',
  arquivada: 'bg-danger/10 text-danger/60 border-danger/20',
  eliminada: 'bg-danger/20 text-danger border-danger/30',
  F2: 'bg-accent/20 text-accent border-accent/30',
  F3: 'bg-warning/20 text-warning border-warning/30',
  F4: 'bg-success/20 text-success border-success/30',
}

export function Badge({ label }: { label: string }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', variants[label] ?? 'bg-muted/20 text-muted border-muted/30')}>
      {label}
    </span>
  )
}
