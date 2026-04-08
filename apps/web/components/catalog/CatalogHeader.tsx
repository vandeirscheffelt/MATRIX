import { Bird } from 'lucide-react'

export function CatalogHeader() {
  return (
    <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-white/[0.06] px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center gap-2">
        <Bird size={20} className="text-emerald-400" />
        <span className="font-semibold text-sm text-white">Filhotes disponíveis</span>
      </div>
    </header>
  )
}
