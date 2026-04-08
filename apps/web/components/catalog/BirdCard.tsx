import Image from 'next/image'
import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { PriceTag } from './PriceTag'

interface BirdCardProps {
  bird: {
    id: string
    name?: string
    mutation: string
    price_cents: number
    status: string
    photos?: string[]
    gender: string
  }
}

export function BirdCard({ bird }: BirdCardProps) {
  const photo = bird.photos?.[0]

  return (
    <Link
      href={`/catalog/${bird.id}`}
      className="group rounded-2xl overflow-hidden bg-zinc-900 border border-white/[0.06] active:scale-[0.98] transition-transform"
    >
      {/* Foto */}
      <div className="relative aspect-square bg-zinc-800">
        {photo ? (
          <Image
            src={photo}
            alt={bird.name ?? bird.mutation}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, 200px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-4xl">
            🐦
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StatusBadge status={bird.status} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-0.5">
        <p className="text-xs text-zinc-400 truncate">{bird.mutation}</p>
        {bird.name && (
          <p className="text-sm font-semibold text-white truncate">{bird.name}</p>
        )}
        <p className="text-sm font-bold text-emerald-400">
          <PriceTag cents={bird.price_cents} />
        </p>
      </div>
    </Link>
  )
}
