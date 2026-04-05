'use client'

import { Menu } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  onMenuClick?: () => void
}

export function Header({ title, subtitle, action, onMenuClick }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-bg-primary sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-text-secondary hover:text-text-primary transition-colors"
        >
          <Menu size={20} />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-text-primary leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div>{action}</div>}
    </header>
  )
}
