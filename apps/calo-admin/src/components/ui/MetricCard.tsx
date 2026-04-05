import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface MetricCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  color?: 'blue' | 'green' | 'yellow' | 'gray'
  sub?: string
}

const colors = {
  blue:   'text-accent bg-accent/10',
  green:  'text-green-400 bg-green-400/10',
  yellow: 'text-yellow-400 bg-yellow-400/10',
  gray:   'text-text-secondary bg-white/[0.06]',
}

export function MetricCard({ label, value, icon: Icon, color = 'blue', sub }: MetricCardProps) {
  return (
    <div className="bg-bg-secondary border border-white/[0.06] rounded-xl p-5 flex items-start gap-4">
      <div className={cn('p-2.5 rounded-lg flex-shrink-0', colors[color])}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-text-secondary text-sm">{label}</p>
        <p className="text-2xl font-bold text-text-primary mt-0.5">{value}</p>
        {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
      </div>
    </div>
  )
}
