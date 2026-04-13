'use client'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, type Campanha } from '@/lib/api'
import { fmt } from '@/lib/utils'
import { Pause, Play, ChevronRight, Trash2 } from 'lucide-react'
import Link from 'next/link'

interface Props {
  campanha: Campanha
  onUpdate: () => void
  selecionada?: boolean
  onToggle?: () => void
}

export function CampanhaRow({ campanha, onUpdate, selecionada = false, onToggle }: Props) {
  const [loading, setLoading] = useState(false)

  async function toggleStatus() {
    setLoading(true)
    try {
      const next = campanha.status === 'ativa' ? 'pausada' : 'ativa'
      await api.campanhas.setStatus(campanha.id, next)
      onUpdate()
    } finally {
      setLoading(false)
    }
  }

  async function deletar() {
    if (!confirm(`Excluir campanha "${campanha.nome}"?`)) return
    setLoading(true)
    try {
      await api.campanhas.delete(campanha.id)
      onUpdate()
    } finally {
      setLoading(false)
    }
  }

  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      {onToggle !== undefined && (
        <td className="px-4 py-3 w-8">
          <input
            type="checkbox"
            checked={selecionada}
            onChange={onToggle}
            className="accent-accent cursor-pointer"
          />
        </td>
      )}
      <td className="px-4 py-3 text-sm font-mono text-accent">{campanha.campanha_codigo}</td>
      <td className="px-4 py-3 text-sm text-slate-200">{campanha.nome}</td>
      <td className="px-4 py-3"><Badge label={campanha.status} /></td>
      <td className="px-4 py-3"><Badge label={campanha.fase ?? '—'} /></td>
      <td className="px-4 py-3 text-sm text-slate-300">
        {campanha.orcamento_total ? fmt(campanha.orcamento_total, 'currency') : '—'}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleStatus}
            disabled={loading || campanha.status === 'arquivada'}
            title={campanha.status === 'ativa' ? 'Pausar' : 'Ativar'}
          >
            {campanha.status === 'ativa'
              ? <Pause size={14} className="text-warning" />
              : <Play size={14} className="text-success" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={deletar}
            disabled={loading}
            title="Excluir"
          >
            <Trash2 size={14} className="text-red-400" />
          </Button>
          <Link href={`/campanhas/${campanha.id}`}>
            <Button variant="ghost" size="sm">
              <ChevronRight size={14} />
            </Button>
          </Link>
        </div>
      </td>
    </tr>
  )
}
