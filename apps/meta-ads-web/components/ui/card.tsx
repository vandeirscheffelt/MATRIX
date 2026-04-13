import { cn } from '@/lib/utils'

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg bg-card border border-white/5 p-4', className)}>
      {children}
    </div>
  )
}
