'use client'
import { useState } from 'react'
import { api } from '@/lib/api'
import { fmt } from '@/lib/utils'
import { Pencil, Check, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Props {
  adsetId: string
  valor: number
  onUpdate: () => void
}

export function OrcamentoInline({ adsetId, valor, onUpdate }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(valor))
  const [loading, setLoading] = useState(false)

  async function salvar() {
    const novo = parseFloat(draft)
    if (isNaN(novo) || novo <= 0) return
    setLoading(true)
    try {
      await api.adsets.setOrcamento(adsetId, novo)
      onUpdate()
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  if (!editing) {
    return (
      <span className="flex items-center gap-1 text-sm text-slate-300">
        {fmt(valor, 'currency')}
        <button onClick={() => setEditing(true)} className="text-muted hover:text-accent transition-colors">
          <Pencil size={12} />
        </button>
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="w-24 py-1 text-xs"
        type="number"
        step="0.01"
        min="0.01"
        autoFocus
      />
      <Button size="sm" variant="ghost" onClick={salvar} disabled={loading}>
        <Check size={12} className="text-success" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
        <X size={12} className="text-danger" />
      </Button>
    </span>
  )
}
