'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Bird, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Parent {
  name?: string
  mutation: string
  photos?: string[]
}

function ParentCard({
  label,
  parent,
  onClick,
}: {
  label: string
  parent: Parent
  onClick: () => void
}) {
  const photo = parent.photos?.[0] ?? null
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-left w-full hover:bg-white/[0.07] hover:border-white/[0.12] active:scale-[0.98] transition-all duration-150 cursor-pointer"
    >
      <div className="relative w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-800">
        {photo ? (
          <Image src={photo} alt={parent.name ?? parent.mutation} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Bird size={16} className="text-zinc-600" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider leading-none mb-1">{label}</p>
        <p className="text-sm font-medium text-zinc-100 truncate">{parent.name ?? parent.mutation}</p>
        {parent.name && <p className="text-xs text-zinc-500 truncate">{parent.mutation}</p>}
      </div>
    </button>
  )
}

function ParentModal({
  parent,
  label,
  onClose,
}: {
  parent: Parent
  label: string
  onClose: () => void
}) {
  const photos = parent.photos ?? []
  const [selected, setSelected] = useState(0)

  const prev = () => setSelected((s) => (s - 1 + photos.length) % photos.length)
  const next = () => setSelected((s) => (s + 1) % photos.length)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-zinc-900 border border-white/[0.08] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
        >
          <X size={16} />
        </button>

        {/* Foto principal */}
        <div className="relative w-full aspect-square bg-zinc-950">
          {photos.length > 0 ? (
            <Image
              key={selected}
              src={photos[selected]}
              alt={parent.name ?? parent.mutation}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Bird size={48} className="text-zinc-700" />
            </div>
          )}

          {/* Navegação lateral */}
          {photos.length > 1 && (
            <>
              <button
                onClick={prev}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={next}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto p-3">
            {photos.map((url, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`relative w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-150 ${
                  i === selected
                    ? 'border-emerald-400 opacity-100 scale-105'
                    : 'border-white/[0.08] opacity-50 hover:opacity-80'
                }`}
              >
                <Image src={url} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="px-4 pb-4 pt-1">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
          <p className="text-base font-semibold text-zinc-100">{parent.name ?? parent.mutation}</p>
          {parent.name && <p className="text-sm text-zinc-400">{parent.mutation}</p>}
        </div>
      </div>
    </div>
  )
}

export function ParentSection({
  father,
  mother,
}: {
  father?: Parent | null
  mother?: Parent | null
}) {
  const [open, setOpen] = useState<{ parent: Parent; label: string } | null>(null)

  if (!father && !mother) return null

  return (
    <>
      <div className="pt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Genética</h2>
        <div className="grid grid-cols-2 gap-3">
          {father && (
            <ParentCard
              label="Pai"
              parent={father}
              onClick={() => setOpen({ parent: father, label: 'Pai' })}
            />
          )}
          {mother && (
            <ParentCard
              label="Mãe"
              parent={mother}
              onClick={() => setOpen({ parent: mother, label: 'Mãe' })}
            />
          )}
        </div>
      </div>

      {open && (
        <ParentModal
          parent={open.parent}
          label={open.label}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  )
}
