'use client'
import { useEffect, useState, useCallback } from 'react'
import { api, type Campanha } from '@/lib/api'
import { CampanhaRow } from '@/components/campanhas/campanha-row'
import Link from 'next/link'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CampanhasPage() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<string>('todos')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [deletando, setDeletando] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.campanhas.list()
      setCampanhas(data)
      setSelecionados(new Set())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtradas = filtro === 'todos'
    ? campanhas
    : campanhas.filter((c) => c.status === filtro)

  const todasSelecionadas = filtradas.length > 0 && filtradas.every((c) => selecionados.has(c.id))

  function toggleTodas() {
    if (todasSelecionadas) {
      setSelecionados(new Set())
    } else {
      setSelecionados(new Set(filtradas.map((c) => c.id)))
    }
  }

  function toggleUma(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function deletarSelecionadas() {
    if (selecionados.size === 0) return
    if (!confirm(`Excluir ${selecionados.size} campanha(s)?`)) return
    setDeletando(true)
    try {
      await Promise.all([...selecionados].map((id) => api.campanhas.delete(id)))
      await load()
    } finally {
      setDeletando(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-100">Campanhas</h1>
        <div className="flex items-center gap-2">
          {selecionados.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={deletarSelecionadas}
              disabled={deletando}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 size={13} className="mr-1" />
              Excluir {selecionados.size}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </Button>
          <Link href="/nova-campanha">
            <Button size="sm"><Plus size={13} className="mr-1" />Nova</Button>
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {['todos', 'ativa', 'pausada', 'rascunho', 'arquivada'].map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${filtro === f ? 'bg-accent text-bg' : 'bg-card text-muted hover:text-slate-200'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-white/5 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-sidebar text-left text-xs text-muted uppercase tracking-wide">
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={todasSelecionadas}
                  onChange={toggleTodas}
                  className="accent-accent cursor-pointer"
                />
              </th>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Fase</th>
              <th className="px-4 py-3">Orçamento</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <CampanhaRow
                key={c.id}
                campanha={c}
                selecionada={selecionados.has(c.id)}
                onToggle={() => toggleUma(c.id)}
                onUpdate={load}
              />
            ))}
            {filtradas.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted text-sm">
                  Nenhuma campanha encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
