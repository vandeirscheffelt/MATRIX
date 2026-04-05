import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full bg-bg-primary border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary',
        'placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}
export function Label({ className, ...props }: LabelProps) {
  return (
    <label className={cn('text-sm text-text-secondary font-medium', className)} {...props} />
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
