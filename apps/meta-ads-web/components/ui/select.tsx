'use client'
import { cn } from '@/lib/utils'
import { type SelectHTMLAttributes, forwardRef } from 'react'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full rounded bg-bg border border-white/10 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent',
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
)
Select.displayName = 'Select'
