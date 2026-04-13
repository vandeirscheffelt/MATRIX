'use client'
import { useEffect, useState, useRef } from 'react'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Rocket, ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type SseEvento =
  | { tipo: 'inicio';       total_videos: number; total_abordagens: number }
  | { tipo: 'abordagem';    abordagem: string; total: number }
  | { tipo: 'video';        video_codigo: string; etapa: string }
  | { tipo: 'video_ok';     video_codigo: string; meta_ad_id: string }
  | { tipo: 'video_erro';   video_codigo: string; erro: string }
  | { tipo: 'abordagem_ok'; abordagem: string; meta_adset_id: string }
  | { tipo: 'concluido';    campanha_id: string; videos_lancados: number; erros: number }
  | { tipo: 'erro_fatal';   erro: string }

type StatusVideo = 'pendente' | 'processando' | 'ok' | 'erro'

interface LogVideo {
  codigo: string
  etapa: string
  status: StatusVideo
  erro?: string
  meta_ad_id?: string
}

type Pendentes = Record<string, Record<string, { total: number; codigos: string[] }>>

// ─── Componente principal ─────────────────────────────────────────────────────

export default function LancamentosPage() {
  const [pendentes, setPendentes] = useState<Pendentes>({})
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  // Seleção: chave = `campanha_id::abordagem`
  const [selecionado, setSelecionado] = useState<{ campanhaId: string; abordagem: string } | null>(null)
  const [nome, setNome] = useState('')
  const [campanhaCodigoMeta, setCampanhaCodigoMeta] = useState('')
  const [forcar, setForcar] = useState(false)
  const [estrutura, setEstrutura] = useState<'1-1-8' | '1-8-8'>('1-1-8')

  // SSE / progresso
  const [lancando, setLancando] = useState(false)
  const [logs, setLogs] = useState<LogVideo[]>([])
  const [concluido, setConcluido] = useState<{ campanha_id: string; lancados: number; erros: number } | null>(null)
  const [erroFatal, setErroFatal] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.lancamentos.pendentes().then((data) => {
      setPendentes(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [logs])

  function toggleCampanha(campanhaId: string) {
    setExpandidos((prev) => {
      const next = new Set(prev)
      next.has(campanhaId) ? next.delete(campanhaId) : next.add(campanhaId)
      return next
    })
  }

  function selecionar(campanhaId: string, abordagem: string) {
    setSelecionado({ campanhaId, abordagem })
    setNome(`${campanhaId} — ${abordagem}`)
    setCampanhaCodigoMeta(`${campanhaId.toLowerCase()}-${abordagem.toLowerCase().replace(/_/g, '-')}`)
    setConcluido(null)
    setErroFatal(null)
    setLogs([])
  }

  async function lancar() {
    if (!selecionado || !nome || !campanhaCodigoMeta) return
    setLancando(true)
    setConcluido(null)
    setErroFatal(null)
    setLogs([])

    const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3200'
    const res = await fetch(`${BASE}/lancamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campanha_id_atelie: selecionado.campanhaId,
        abordagem_codigo: selecionado.abordagem,
        campanha_codigo: campanhaCodigoMeta,
        nome,
        forcar_relancamento: forcar,
        estrutura,
      }),
    })

    const reader = res.body?.getReader()
    if (!reader) { setLancando(false); return }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const linhas = buffer.split('\n\n')
      buffer = linhas.pop() ?? ''

      for (const linha of linhas) {
        if (!linha.startsWith('data: ')) continue
        try {
          const evento: SseEvento = JSON.parse(linha.slice(6))
          processarEvento(evento)
        } catch { /* ignora parse error */ }
      }
    }

    setLancando(false)
    // Recarrega pendentes
    api.lancamentos.pendentes().then(setPendentes).catch(() => {})
  }

  function processarEvento(evento: SseEvento) {
    if (evento.tipo === 'video') {
      setLogs((prev) => {
        const existe = prev.findIndex((l) => l.codigo === evento.video_codigo)
        const entry: LogVideo = { codigo: evento.video_codigo, etapa: evento.etapa, status: 'processando' }
        if (existe >= 0) {
          const next = [...prev]; next[existe] = entry; return next
        }
        return [...prev, entry]
      })
    }
    if (evento.tipo === 'video_ok') {
      setLogs((prev) => prev.map((l) =>
        l.codigo === evento.video_codigo ? { ...l, status: 'ok', etapa: 'concluído', meta_ad_id: evento.meta_ad_id } : l
      ))
    }
    if (evento.tipo === 'video_erro') {
      setLogs((prev) => prev.map((l) =>
        l.codigo === evento.video_codigo ? { ...l, status: 'erro', etapa: 'erro', erro: evento.erro } : l
      ))
    }
    if (evento.tipo === 'concluido') {
      setConcluido({ campanha_id: evento.campanha_id, lancados: evento.videos_lancados, erros: evento.erros })
    }
    if (evento.tipo === 'erro_fatal') {
      setErroFatal(evento.erro)
    }
  }

  const etapaLabel: Record<string, string> = {
    download_drive: 'Baixando do Drive...',
    upload_meta: 'Enviando para Meta...',
    creative: 'Criando creative...',
    ad: 'Criando anúncio...',
    concluído: 'Publicado',
    erro: 'Erro',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Lançamentos</h1>
        <p className="text-sm text-muted mt-0.5">Selecione uma abordagem para lançar no Meta Ads.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel esquerdo: lista de pendentes */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Vídeos pendentes</h2>
          {loading && <p className="text-sm text-muted">Carregando...</p>}
          {!loading && Object.keys(pendentes).length === 0 && (
            <p className="text-sm text-muted">Nenhum vídeo pendente encontrado no ateliê.</p>
          )}
          {Object.entries(pendentes).map(([campanhaId, abordagens]) => (
            <Card key={campanhaId} className="overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
                onClick={() => toggleCampanha(campanhaId)}
              >
                <span className="text-sm font-mono font-semibold text-accent">{campanhaId}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{Object.keys(abordagens).length} abordagens</span>
                  {expandidos.has(campanhaId)
                    ? <ChevronDown size={14} className="text-muted" />
                    : <ChevronRight size={14} className="text-muted" />}
                </div>
              </button>

              {expandidos.has(campanhaId) && (
                <div className="border-t border-white/5">
                  {Object.entries(abordagens).map(([abordagem, info]) => {
                    const isSelected = selecionado?.campanhaId === campanhaId && selecionado?.abordagem === abordagem
                    return (
                      <button
                        key={abordagem}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-accent/10 border-l-2 border-accent' : 'hover:bg-white/[0.02]'}`}
                        onClick={() => selecionar(campanhaId, abordagem)}
                      >
                        <span className="text-sm text-slate-300">{abordagem}</span>
                        <span className="text-xs bg-card px-2 py-0.5 rounded text-muted">{info.total} vídeos</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Painel direito: config + log */}
        <div className="space-y-4">
          {selecionado ? (
            <>
              <Card className="p-4 space-y-4">
                <h2 className="text-xs font-semibold text-muted uppercase tracking-wide">Configurar lançamento</h2>
                <div>
                  <label className="text-xs text-muted mb-1 block">Nome da campanha no Meta</label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-1 block">Código interno (meta_ads)</label>
                  <Input value={campanhaCodigoMeta} onChange={(e) => setCampanhaCodigoMeta(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted mb-2 block">Estrutura de AdSets</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['1-1-8', '1-8-8'] as const).map((op) => (
                      <button
                        key={op}
                        onClick={() => setEstrutura(op)}
                        className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                          estrutura === op
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-white/10 text-muted hover:border-white/20'
                        }`}
                      >
                        <span className="font-mono">{op}</span>
                        <span className="block text-xs font-normal mt-0.5 text-muted">
                          {op === '1-1-8' ? '1 AdSet · 8 ads' : '8 AdSets · 1 ad cada'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forcar}
                    onChange={(e) => setForcar(e.target.checked)}
                    className="accent-accent"
                  />
                  Forçar relançamento (inclui vídeos já publicados)
                </label>
                <Button
                  onClick={lancar}
                  disabled={lancando || !nome || !campanhaCodigoMeta}
                  className="w-full"
                >
                  {lancando
                    ? <><Loader2 size={14} className="mr-2 animate-spin" />Lançando...</>
                    : <><Rocket size={14} className="mr-2" />Lançar {selecionado.abordagem}</>}
                </Button>
              </Card>

              {/* Log em tempo real */}
              {logs.length > 0 && (
                <Card className="p-4">
                  <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Progresso</h2>
                  <div ref={logRef} className="space-y-1.5 max-h-64 overflow-y-auto">
                    {logs.map((log) => (
                      <div key={log.codigo} className="flex items-center gap-2.5 text-sm">
                        {log.status === 'ok' && <CheckCircle2 size={14} className="text-success shrink-0" />}
                        {log.status === 'erro' && <XCircle size={14} className="text-red-400 shrink-0" />}
                        {log.status === 'processando' && <Loader2 size={14} className="text-accent animate-spin shrink-0" />}
                        {log.status === 'pendente' && <div className="w-3.5 h-3.5 rounded-full border border-muted/40 shrink-0" />}
                        <span className="font-mono text-xs text-slate-300">{log.codigo}</span>
                        <span className="text-xs text-muted">{etapaLabel[log.etapa] ?? log.etapa}</span>
                        {log.erro && <span className="text-xs text-red-400 truncate">{log.erro}</span>}
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {concluido && (
                <Card className="p-4 border border-success/20 bg-success/5">
                  <div className="flex items-center gap-2 text-success font-medium text-sm">
                    <CheckCircle2 size={16} />
                    Lançamento concluído
                  </div>
                  <p className="text-xs text-muted mt-1">
                    {concluido.lancados} vídeos publicados · {concluido.erros} erro(s)
                  </p>
                </Card>
              )}

              {erroFatal && (
                <Card className="p-4 border border-red-500/20 bg-red-500/5">
                  <div className="flex items-center gap-2 text-red-400 font-medium text-sm">
                    <XCircle size={16} />
                    Erro fatal
                  </div>
                  <p className="text-xs text-muted mt-1">{erroFatal}</p>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-8 text-center">
              <Rocket size={32} className="text-muted/30 mx-auto mb-3" />
              <p className="text-sm text-muted">Selecione uma abordagem à esquerda para configurar o lançamento.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
