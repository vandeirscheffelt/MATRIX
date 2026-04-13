'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'

interface Config {
  orcamento_diario_padrao: number
  objetivo: 'MESSAGES' | 'CONVERSIONS'
  publico_config: {
    geo_locations?: { countries: string[] }
    age_min?: number
    age_max?: number
  }
  janela_avaliacao_h: number
  gasto_minimo_corte: number
  mensagem_padrao: string
}

export default function ConfiguracoesPage() {
  const [config, setConfig] = useState<Config>({
    orcamento_diario_padrao: 10,
    objetivo: 'MESSAGES',
    publico_config: { geo_locations: { countries: ['BR'] }, age_min: 25, age_max: 55 },
    janela_avaliacao_h: 72,
    gasto_minimo_corte: 10,
    mensagem_padrao: 'Olá, gostaria de informações sobre o produto',
  })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [ok, setOk] = useState(false)

  useEffect(() => {
    api.configuracoes.get().then((data) => {
      setConfig(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function salvar() {
    setSalvando(true)
    setOk(false)
    try {
      await api.configuracoes.save(config)
      setOk(true)
      setTimeout(() => setOk(false), 3000)
    } finally {
      setSalvando(false)
    }
  }

  function set<K extends keyof Config>(key: K, value: Config[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) return <p className="text-muted text-sm">Carregando...</p>

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-slate-100">Configurações</h1>
      <p className="text-sm text-muted">Parâmetros globais aplicados a todos os lançamentos.</p>

      <Card className="p-5 space-y-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Orçamento & Objetivo</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Orçamento diário por AdSet (R$)</label>
            <Input
              type="number"
              min={1}
              step={0.5}
              value={config.orcamento_diario_padrao}
              onChange={(e) => set('orcamento_diario_padrao', parseFloat(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Objetivo</label>
            <Select
              value={config.objetivo}
              onChange={(e) => set('objetivo', e.target.value as Config['objetivo'])}
            >
              <option value="MESSAGES">MESSAGES (WhatsApp)</option>
              <option value="CONVERSIONS">CONVERSIONS</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted mb-1 block">Janela de avaliação (horas)</label>
            <Input
              type="number"
              min={24}
              step={24}
              value={config.janela_avaliacao_h}
              onChange={(e) => set('janela_avaliacao_h', parseInt(e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Gasto mínimo para corte (R$)</label>
            <Input
              type="number"
              min={1}
              value={config.gasto_minimo_corte}
              onChange={(e) => set('gasto_minimo_corte', parseFloat(e.target.value))}
            />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-5">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Público Padrão</h2>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-muted mb-1 block">País</label>
            <Input
              value={config.publico_config?.geo_locations?.countries?.[0] ?? 'BR'}
              onChange={(e) =>
                set('publico_config', {
                  ...config.publico_config,
                  geo_locations: { countries: [e.target.value.toUpperCase()] },
                })
              }
              maxLength={2}
              placeholder="BR"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Idade mínima</label>
            <Input
              type="number"
              min={18}
              max={65}
              value={config.publico_config?.age_min ?? 25}
              onChange={(e) =>
                set('publico_config', { ...config.publico_config, age_min: parseInt(e.target.value) })
              }
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Idade máxima</label>
            <Input
              type="number"
              min={18}
              max={65}
              value={config.publico_config?.age_max ?? 55}
              onChange={(e) =>
                set('publico_config', { ...config.publico_config, age_max: parseInt(e.target.value) })
              }
            />
          </div>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Mensagem WhatsApp</h2>
        <p className="text-xs text-muted">
          Mensagem padrão enviada ao usuário. O carimbo de rastreamento (ex: <code className="text-accent">CP01_F2_V01</code>) é acrescentado automaticamente ao final.
        </p>
        <Input
          value={config.mensagem_padrao}
          onChange={(e) => set('mensagem_padrao', e.target.value)}
          placeholder="Olá, gostaria de informações sobre o produto"
        />
        <p className="text-xs text-muted/60">
          Resultado final: <span className="text-slate-400">{config.mensagem_padrao} - CP01_F2_V01</span>
        </p>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={salvar} disabled={salvando}>
          <Save size={14} className="mr-1.5" />
          {salvando ? 'Salvando...' : 'Salvar configurações'}
        </Button>
        {ok && <span className="text-sm text-success">Salvo com sucesso!</span>}
      </div>
    </div>
  )
}
