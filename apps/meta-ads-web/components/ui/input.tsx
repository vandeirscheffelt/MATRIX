'use client'
import { cn } from '@/lib/utils'
import { type InputHTMLAttributes, forwardRef } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full rounded bg-bg border border-white/10 px-3 py-2 text-sm text-slate-200 placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
