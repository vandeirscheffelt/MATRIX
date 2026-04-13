const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3200'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
    ...init,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || res.statusText)
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  return res.json() as Promise<T>
}

// ─── Tipos inline ─────────────────────────────────────────────────────────────

export type CampanhaStatus = 'rascunho' | 'ativa' | 'pausada' | 'arquivada'

export interface Campanha {
  id: string
  campanha_codigo: string
  nome: string
  objetivo: string
  status: CampanhaStatus
  fase: string | null
  produto_codigo: string | null
  orcamento_total: number | null
  janela_avaliacao_h: number
  gasto_minimo_corte: number
  meta_campaign_id: string | null
  criada_em: string
  publicada_em: string | null
}

export interface Adset {
  id: string
  campanha_id: string
  meta_adset_id: string | null
  nome: string
  abordagem: string | null
  status: string
  orcamento_diario: number
  ads?: Ad[]
}

export interface Ad {
  id: string
  adset_id: string
  nome: string
  video_codigo: string | null
  copy_variante: string | null
  copy_texto: string | null
  status: string
  meta_ad_id: string | null
}

export interface MetricaDiaria {
  id: string
  data_referencia: string
  impressoes: number
  cliques: number
  gasto: number
  ctr: number | null
  cpm: number | null
  conversas_iniciadas: number
  leads_crm: number
  vendas_crm: number
  cpl_crm: number | null
}

export interface ScalerLog {
  id: string
  acao: string
  motivo: string | null
  valor_antes: number | null
  valor_depois: number | null
  executado_em: string
}

export interface RegraScaler {
  id: string
  campanha_id: string
  tipo: string
  metrica: string
  operador: string
  valor: number
  acao_valor: number | null
  ativa: boolean
}

// ─── API calls ────────────────────────────────────────────────────────────────

export const api = {
  campanhas: {
    list: () => req<Campanha[]>('/campanhas'),
    get: (id: string) =>
      req<Campanha & { adsets: (Adset & { ads: Ad[] })[] }>(`/campanhas/${id}`),
    create: (body: unknown) =>
      req<{ id: string }>('/campanhas', { method: 'POST', body: JSON.stringify(body) }),
    setStatus: (id: string, status: string) =>
      req<Campanha>(`/campanhas/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    delete: (id: string) => req<void>(`/campanhas/${id}`, { method: 'DELETE' }),
    metricas: (id: string, dias = 7) =>
      req<MetricaDiaria[]>(`/campanhas/${id}/metricas?dias=${dias}`),
    log: (id: string) => req<ScalerLog[]>(`/campanhas/${id}/log`),
  },
  ads: {
    setStatus: (id: string, status: string) =>
      req<Ad>(`/ads/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
  adsets: {
    setOrcamento: (id: string, orcamento_diario: number) =>
      req<Adset>(`/adsets/${id}/orcamento`, {
        method: 'PATCH',
        body: JSON.stringify({ orcamento_diario }),
      }),
  },
  regras: {
    list: (campanhaId: string) => req<RegraScaler[]>(`/regras/${campanhaId}`),
    create: (body: unknown) =>
      req<RegraScaler>('/regras', { method: 'POST', body: JSON.stringify(body) }),
    delete: (id: string) => req<void>(`/regras/${id}`, { method: 'DELETE' }),
  },
  configuracoes: {
    get: () => req<{
      orcamento_diario_padrao: number
      objetivo: 'MESSAGES' | 'CONVERSIONS'
      publico_config: Record<string, unknown>
      janela_avaliacao_h: number
      gasto_minimo_corte: number
      mensagem_padrao: string
    }>('/configuracoes'),
    save: (body: unknown) => req<void>('/configuracoes', { method: 'PUT', body: JSON.stringify(body) }),
  },
  lancamentos: {
    pendentes: () => req<Record<string, Record<string, { total: number; codigos: string[] }>>>('/lancamentos/pendentes'),
  },
}
