'use client'
import { useRouter } from 'next/navigation'
import { CampanhaRow } from './campanha-row'
import type { Campanha } from '@/lib/api'

export function DashboardTable({ campanhas }: { campanhas: Campanha[] }) {
  const router = useRouter()

  return (
    <>
      {campanhas.length === 0 ? (
        <tr>
          <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">
            Nenhuma campanha encontrada.
          </td>
        </tr>
      ) : (
        campanhas.map((c) => (
          <CampanhaRow key={c.id} campanha={c} onUpdate={() => router.refresh()} />
        ))
      )}
    </>
  )
}
