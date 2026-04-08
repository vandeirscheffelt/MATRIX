import { BirdCard } from '@/components/catalog/BirdCard'
import { CatalogHeader } from '@/components/catalog/CatalogHeader'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

async function getBirds() {
  try {
    const res = await fetch(`${API}/calo/birds?status=available&limit=100`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return []
    const json = await res.json()
    return json.data ?? []
  } catch {
    return []
  }
}

export const metadata = {
  title: 'Filhotes disponíveis | Calo',
  description: 'Escolha sua calopsita com genética comprovada.',
}

export default async function CatalogPage() {
  const birds = await getBirds()

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <CatalogHeader />
      <main className="max-w-lg mx-auto px-4 pb-12 pt-4">
        {birds.length === 0 ? (
          <p className="text-center py-20 text-zinc-500 text-sm">
            Nenhum filhote disponível no momento.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {birds.map((bird: any) => (
              <BirdCard key={bird.id} bird={bird} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
