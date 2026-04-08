import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Bird } from 'lucide-react'
import { ReserveButton } from '@/components/catalog/ReserveButton'
import { StatusBadge } from '@/components/catalog/StatusBadge'
import { PhotoGallery } from '@/components/catalog/PhotoGallery'

function ParentCard({ label, parent }: { label: string; parent: { name?: string; mutation: string; photos?: string[] } }) {
  const photo = parent.photos?.[0] ?? null
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
      <div className="relative w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
        {photo
          ? <Image src={photo} alt={parent.name ?? parent.mutation} fill className="object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Bird size={16} className="text-zinc-600" /></div>
        }
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none mb-1">{label}</p>
        <p className="text-sm font-medium text-zinc-100 truncate">{parent.name ?? parent.mutation}</p>
        {parent.name && <p className="text-xs text-zinc-500 truncate">{parent.mutation}</p>}
      </div>
    </div>
  )
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getBird(id: string) {
  try {
    const res = await fetch(`${API}/calo/birds/${id}`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

const genderLabel: Record<string, string> = {
  male: 'Macho', female: 'Fêmea', unknown: 'Indefinido',
}

const formatPrice = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)

export default async function BirdDetailPage({ params }: { params: { id: string } }) {
  const bird = await getBird(params.id)
  if (!bird) notFound()

  const photos: string[] = bird.photos ?? []

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur border-b border-white/[0.06] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/catalog" className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <span className="font-medium text-sm">{bird.name ?? bird.mutation}</span>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="max-w-4xl mx-auto px-4 py-6 md:grid md:grid-cols-2 md:gap-8">

        {/* Coluna esquerda — fotos */}
        <div>
          <PhotoGallery
            photos={photos}
            alt={bird.name ?? bird.mutation}
            status={<StatusBadge status={bird.status} />}
          />
        </div>

        {/* Coluna direita — info */}
        <div className="mt-6 md:mt-0 space-y-5">
          {/* Nome + preço */}
          <div className="flex items-start justify-between gap-2">
            <div>
              {bird.name && <h1 className="text-2xl font-bold">{bird.name}</h1>}
              <p className="text-zinc-400 text-sm mt-0.5">{bird.mutation}</p>
            </div>
            <span className="text-2xl font-bold text-emerald-400 whitespace-nowrap">
              {formatPrice(bird.price_cents)}
            </span>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full bg-white/[0.07] text-xs text-zinc-300">
              {genderLabel[bird.gender] ?? 'Indefinido'}
            </span>
            {bird.birth_date && (
              <span className="px-3 py-1 rounded-full bg-white/[0.07] text-xs text-zinc-300">
                Nascido em {new Date(bird.birth_date).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>

          {/* Descrição */}
          {bird.description && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">Sobre</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">{bird.description}</p>
            </div>
          )}

          {/* CTA */}
          <ReserveButton bird={bird} />

          {/* Genética */}
          {(bird.father || bird.mother) && (
            <div className="pt-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Genética</h2>
              <div className="grid grid-cols-2 gap-3">
                {bird.father && (
                  <ParentCard label="Pai" parent={bird.father} />
                )}
                {bird.mother && (
                  <ParentCard label="Mãe" parent={bird.mother} />
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
