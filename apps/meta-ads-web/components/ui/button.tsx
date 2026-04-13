'use client'
import { cn } from '@/lib/utils'
import { type ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'primary', size = 'md', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded font-medium transition-colors disabled:opacity-50',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        variant === 'primary' && 'bg-accent text-bg hover:bg-accent/90',
        variant === 'ghost'   && 'text-slate-300 hover:bg-white/5',
        variant === 'danger'  && 'bg-danger/20 text-danger hover:bg-danger/30 border border-danger/30',
        variant === 'outline' && 'border border-white/10 text-slate-300 hover:bg-white/5',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
