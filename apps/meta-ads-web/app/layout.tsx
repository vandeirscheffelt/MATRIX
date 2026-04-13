import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { LayoutDashboard, Megaphone, Plus, Rocket, Settings } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Meta Ads Manager',
  description: 'Gestão de campanhas Meta Ads — Matrix',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="flex min-h-screen bg-bg">
        {/* Sidebar */}
        <aside className="w-56 bg-sidebar border-r border-white/5 flex flex-col shrink-0">
          <div className="px-4 py-5 border-b border-white/5">
            <span className="text-sm font-semibold text-accent tracking-wide">Meta Ads</span>
            <p className="text-[10px] text-muted mt-0.5">Matrix Workspace</p>
          </div>
          <nav className="flex-1 px-2 py-4 space-y-1">
            <NavItem href="/" icon={<LayoutDashboard size={15} />} label="Dashboard" />
            <NavItem href="/lancamentos" icon={<Rocket size={15} />} label="Lançamentos" />
            <NavItem href="/campanhas" icon={<Megaphone size={15} />} label="Campanhas" />
            <NavItem href="/nova-campanha" icon={<Plus size={15} />} label="Nova Campanha" />
            <NavItem href="/configuracoes" icon={<Settings size={15} />} label="Configurações" />
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </body>
    </html>
  )
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 rounded text-sm text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors"
    >
      {icon}
      {label}
    </Link>
  )
}
