'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Bird } from 'lucide-react'
const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ')

interface PhotoGalleryProps {
  photos: string[]
  alt: string
  status?: React.ReactNode
}

export function PhotoGallery({ photos, alt, status }: PhotoGalleryProps) {
  const [selected, setSelected] = useState(0)

  if (photos.length === 0) {
    return (
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-zinc-900 flex items-center justify-center">
        <Bird size={64} className="text-zinc-700" />
        {status && <div className="absolute top-3 right-3">{status}</div>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Imagem principal */}
      <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-zinc-900">
        <Image
          key={selected}
          src={photos[selected]}
          alt={alt}
          fill
          className="object-cover transition-opacity duration-300 animate-fade-in"
          priority
        />
        {status && <div className="absolute top-3 right-3">{status}</div>}
      </div>

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={i}
              onClick={() => setSelected(i)}
              className={cn(
                'relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-150',
                i === selected
                  ? 'border-emerald-400 opacity-100 scale-105'
                  : 'border-white/[0.08] opacity-50 hover:opacity-80 hover:scale-105'
              )}
            >
              <Image src={url} alt="" fill className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
