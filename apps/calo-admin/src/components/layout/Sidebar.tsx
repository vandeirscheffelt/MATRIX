'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Bird, Dna, ShoppingBag, BookmarkCheck,
  Store, Truck, Settings, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/dashboard',    label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/birds',        label: 'Filhotes',    icon: Bird },
  { href: '/parents',      label: 'Pais',        icon: Dna },
  { href: '/orders',       label: 'Pedidos',     icon: ShoppingBag },
  { href: '/reservations', label: 'Reservas',    icon: BookmarkCheck },
  { href: '/buyers',       label: 'Clientes',    icon: Store },
  { href: '/shipping',     label: 'Frete',       icon: Truck },
  { href: '/settings',     label: 'Configurações', icon: Settings },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={cn(
        'fixed left-0 top-0 z-30 h-full w-60 flex flex-col',
        'bg-[#13161f] border-r border-white/[0.06]',
        'transition-transform duration-200 ease-in-out',
        'lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Bird size={14} className="text-white" />
            </div>
            <span className="font-semibold text-text-primary tracking-tight">Calo Admin</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-text-secondary hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.04]'
                )}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/[0.06]">
          <p className="text-xs text-text-muted">v1.0.0 · Calo Sistema</p>
        </div>
      </aside>
    </>
  )
}
