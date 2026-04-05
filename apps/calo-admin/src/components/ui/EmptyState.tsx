import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 rounded-2xl bg-white/[0.04] mb-4">
        <Icon size={28} className="text-text-muted" />
      </div>
      <h3 className="text-text-primary font-medium mb-1">{title}</h3>
      {description && <p className="text-sm text-text-secondary max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
