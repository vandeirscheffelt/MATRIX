import { Card } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <Card>
      <p className="text-xs text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-100">{value}</p>
      {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
    </Card>
  )
}
