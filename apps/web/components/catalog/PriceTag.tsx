'use client'

export function PriceTag({ cents }: { cents: number }) {
  return (
    <span>
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)}
    </span>
  )
}
