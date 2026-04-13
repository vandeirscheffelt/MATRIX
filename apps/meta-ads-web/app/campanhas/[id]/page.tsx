'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { api, type Campanha, type Adset, type Ad, type MetricaDiaria, type ScalerLog, type RegraScaler } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { MetricasChart } from '@/components/campanhas/metricas-chart'
import { OrcamentoInline } from '@/components/campanhas/orcamento-inline'
import { fmt, fmtDate } from '@/lib/utils'
import { Pause, Play, Trash2, Plus, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type TabKey = 'anuncios' | 'metricas' | 'regras' | 'log'

type CampanhaDetalhe = Campanha & { adsets: (Adset & { ads: Ad[] })[] }

export default function CampanhaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const [campanha, setCampanha] = useState<CampanhaDetalhe | null>(null)
  const [metricas, setMetricas] = useState<MetricaDiaria[]>([])
  const [logs, setLogs] = useState<ScalerLog[]>([])
  const [regras, setRegras] = useState<RegraScaler[]>([])
  const [tab, setTab] = useState<TabKey>('anuncios')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [c, m, l] = await Promise.all([
        api.campanhas.get(id),
        api.campanhas.metricas(id, 14),
        api.campanhas.log(id),
      ])
      setCampanha(c)
      setMetricas(m)
      setLogs(l)
      const r = await api.regras.list(id)
      setRegras(r)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  async function toggleCampanha() {
    if (!campanha) return
    const next = campanha.status === 'ativa' ? 'pausada' : 'ativa'
    await api.campanhas.setStatus(id, next)
    load()
  }

  async function toggleAd(adId: string, status: string) {
    const next = status === 'ativa' ? 'pausada' : 'ativa'
    await api.ads.setStatus(adId, next)
    load()
  }

  if (loading || !campanha) {
    return <div className="text-muted text-sm p-6">Carregando...</div>
  }

  const totalLeads = metricas.reduce((s, m) => s + m.leads_crm, 0)
  const totalGasto = metricas.reduce((s, m) => s + m.gasto, 0)
  const cplMedio = totalLeads > 0 ? totalGasto / totalLeads : 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/campanhas" className="text-muted hover:text-slate-200 transition-colors">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100">{campanha.nome}</h1>
              <Badge label={campanha.status} />
              {campanha.fase && <Badge label={campanha.fase} />}
            </div>
            <p className="text-xs text-muted mt-0.5 font-mono">{campanha.campanha_codigo}</p>
          </div>
        </div>
        <Button
          variant={campanha.status === 'ativa' ? 'danger' : 'outline'}
          size="sm"
          onClick={toggleCampanha}
        >
          {campanha.status === 'ativa'
            ? <><Pause size={13} className="mr-1" />Pausar</>
            : <><Play size={13} className="mr-1" />Ativar</>}
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <p className="text-xs text-muted">Gasto total (14d)</p>
          <p className="text-lg font-bold text-slate-100">{fmt(totalGasto, 'currency')}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Leads CRM (14d)</p>
          <p className="text-lg font-bold text-slate-100">{totalLeads}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">CPL médio (14d)</p>
          <p className="text-lg font-bold text-slate-100">{fmt(cplMedio, 'currency')}</p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/5 flex gap-0">
        {(['anuncios', 'metricas', 'regras', 'log'] as TabKey[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-slate-200'
            }`}
          >
            {t === 'anuncios' ? 'Anúncios' : t === 'metricas' ? 'Métricas' : t === 'regras' ? 'Regras' : 'Log'}
          </button>
        ))}
      </div>

      {/* Tab: Anúncios */}
      {tab === 'anuncios' && (
        <div className="space-y-4">
          {campanha.adsets.map((adset) => (
            <Card key={adset.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-200">{adset.nome}</span>
                  {adset.abordagem && <span className="text-xs text-muted">({adset.abordagem})</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">Orçamento/dia:</span>
                  <OrcamentoInline adsetId={adset.id} valor={adset.orcamento_diario} onUpdate={load} />
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted text-left border-b border-white/5">
                    <th className="pb-2">Nome</th>
                    <th className="pb-2">Variante</th>
                    <th className="pb-2">Vídeo</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {adset.ads.map((ad) => (
                    <tr key={ad.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="py-2 font-mono text-slate-300">{ad.nome}</td>
                      <td className="py-2 text-accent">{ad.copy_variante}</td>
                      <td className="py-2 text-muted">{ad.video_codigo ?? '—'}</td>
                      <td className="py-2"><Badge label={ad.status} /></td>
                      <td className="py-2">
                        <button
                          onClick={() => toggleAd(ad.id, ad.status)}
                          className="text-muted hover:text-slate-200 transition-colors"
                          title={ad.status === 'ativa' ? 'Pausar' : 'Ativar'}
                        >
                          {ad.status === 'ativa'
                            ? <Pause size={12} className="text-warning" />
                            : <Play size={12} className="text-success" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))}
        </div>
      )}

      {/* Tab: Métricas */}
      {tab === 'metricas' && (
        <div className="space-y-4">
          <Card>
            <MetricasChart data={metricas} />
          </Card>
          <div className="rounded-lg border border-white/5 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-sidebar text-muted text-left uppercase tracking-wide">
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Impressões</th>
                  <th className="px-4 py-3">Cliques</th>
                  <th className="px-4 py-3">Gasto</th>
                  <th className="px-4 py-3">CTR</th>
                  <th className="px-4 py-3">Conversas</th>
                  <th className="px-4 py-3">Leads CRM</th>
                  <th className="px-4 py-3">CPL</th>
                </tr>
              </thead>
              <tbody>
                {metricas.map((m) => (
                  <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-2">{fmtDate(m.data_referencia)}</td>
                    <td className="px-4 py-2">{fmt(m.impressoes)}</td>
                    <td className="px-4 py-2">{fmt(m.cliques)}</td>
                    <td className="px-4 py-2">{fmt(m.gasto, 'currency')}</td>
                    <td className="px-4 py-2">{m.ctr ? fmt(m.ctr, 'percent') : '—'}</td>
                    <td className="px-4 py-2">{m.conversas_iniciadas}</td>
                    <td className="px-4 py-2 text-success font-medium">{m.leads_crm}</td>
                    <td className="px-4 py-2 text-accent">{m.cpl_crm ? fmt(m.cpl_crm, 'currency') : '—'}</td>
                  </tr>
                ))}
                {metricas.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-muted">Sem dados ainda.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Regras */}
      {tab === 'regras' && (
        <div className="space-y-4">
          <RegrasForm campanhaId={id} onSave={load} />
          <div className="rounded-lg border border-white/5 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-sidebar text-muted text-left uppercase tracking-wide">
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Métrica</th>
                  <th className="px-4 py-3">Condição</th>
                  <th className="px-4 py-3">Ação</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {regras.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="px-4 py-2"><Badge label={r.tipo} /></td>
                    <td className="px-4 py-2 font-mono text-accent">{r.metrica}</td>
                    <td className="px-4 py-2 text-slate-300">{r.operador} {r.valor}</td>
                    <td className="px-4 py-2 text-muted">{r.acao_valor ? `${r.acao_valor}%` : '—'}</td>
                    <td className="px-4 py-2">{r.ativa ? <Badge label="ativa" /> : <Badge label="pausada" />}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={async () => { await api.regras.delete(r.id); load() }}
                        className="text-muted hover:text-danger transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {regras.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Sem regras configuradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Log */}
      {tab === 'log' && (
        <div className="rounded-lg border border-white/5 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-sidebar text-muted text-left uppercase tracking-wide">
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Antes</th>
                <th className="px-4 py-3">Depois</th>
                <th className="px-4 py-3">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-2 text-muted">{fmtDate(l.executado_em)}</td>
                  <td className="px-4 py-2"><Badge label={l.acao} /></td>
                  <td className="px-4 py-2">{l.valor_antes ?? '—'}</td>
                  <td className="px-4 py-2">{l.valor_depois ?? '—'}</td>
                  <td className="px-4 py-2 text-muted">{l.motivo ?? '—'}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">Sem ações registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Formulário de nova regra ─────────────────────────────────────────────────

function RegrasForm({ campanhaId, onSave }: { campanhaId: string; onSave: () => void }) {
  const [form, setForm] = useState({ tipo: 'PAUSA', metrica: 'cpl_crm', operador: 'gt', valor: '', acao_valor: '' })
  const [loading, setLoading] = useState(false)

  async function salvar() {
    if (!form.valor) return
    setLoading(true)
    try {
      await api.regras.create({
        campanha_id: campanhaId,
        tipo: form.tipo,
        metrica: form.metrica,
        operador: form.operador,
        valor: parseFloat(form.valor),
        acao_valor: form.acao_valor ? parseFloat(form.acao_valor) : undefined,
      })
      setForm({ tipo: 'PAUSA', metrica: 'cpl_crm', operador: 'gt', valor: '', acao_valor: '' })
      onSave()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <p className="text-xs text-muted mb-3 uppercase tracking-wide">Nova Regra</p>
      <div className="flex flex-wrap gap-2 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted">Tipo</label>
          <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="w-28">
            <option value="PAUSA">PAUSA</option>
            <option value="CORTE">CORTE</option>
            <option value="ESCALA">ESCALA</option>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Métrica</label>
          <Select value={form.metrica} onChange={(e) => setForm({ ...form, metrica: e.target.value })} className="w-36">
            <option value="cpl_crm">cpl_crm</option>
            <option value="ctr">ctr</option>
            <option value="gasto">gasto</option>
            <option value="leads_crm">leads_crm</option>
            <option value="conversas_iniciadas">conversas</option>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Operador</label>
          <Select value={form.operador} onChange={(e) => setForm({ ...form, operador: e.target.value })} className="w-20">
            <option value="gt">&gt;</option>
            <option value="lt">&lt;</option>
            <option value="eq">=</option>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Valor</label>
          <Input value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="w-24" type="number" placeholder="ex: 20" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted">Ação % (escala)</label>
          <Input value={form.acao_valor} onChange={(e) => setForm({ ...form, acao_valor: e.target.value })} className="w-24" type="number" placeholder="ex: 50" />
        </div>
        <Button size="sm" onClick={salvar} disabled={loading}>
          <Plus size={13} className="mr-1" />Adicionar
        </Button>
      </div>
    </Card>
  )
}
