// ─── Enums ────────────────────────────────────────────────────────────────────

export type CampanhaStatus = 'rascunho' | 'ativa' | 'pausada' | 'arquivada'
export type AdStatus = 'rascunho' | 'ativa' | 'pausada' | 'eliminada'
export type Objetivo = 'MESSAGES' | 'CONVERSIONS'
export type Fase = 'F2' | 'F3' | 'F4'
export type ScalerTipo = 'CORTE' | 'ESCALA' | 'PAUSA'
export type ScalerOperador = 'gt' | 'lt' | 'eq'

// ─── Tabelas do banco ─────────────────────────────────────────────────────────

export interface Campanha {
  id: string
  campanha_codigo: string
  meta_campaign_id: string | null
  nome: string
  objetivo: Objetivo
  status: CampanhaStatus
  orcamento_total: number | null
  janela_avaliacao_h: number
  gasto_minimo_corte: number
  produto_codigo: string | null
  fase: Fase | null
  atelie_campanha_ref: string | null
  criada_em: string
  publicada_em: string | null
  atualizada_em: string
}

export interface Adset {
  id: string
  campanha_id: string
  meta_adset_id: string | null
  nome: string
  abordagem: string | null
  status: AdStatus
  orcamento_diario: number
  publico_config: Record<string, unknown> | null
  criado_em: string
}

export interface Ad {
  id: string
  adset_id: string
  meta_ad_id: string | null
  meta_creative_id: string | null
  meta_video_id: string | null
  nome: string
  video_codigo: string | null
  drive_file_id: string | null
  copy_variante: string | null
  copy_texto: string | null
  status: AdStatus
  criado_em: string
}

export interface MetricaDiaria {
  id: string
  campanha_id: string
  adset_id: string | null
  ad_id: string | null
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
  coletado_em: string
}

export interface RegraScaler {
  id: string
  campanha_id: string
  tipo: ScalerTipo
  metrica: string
  operador: ScalerOperador
  valor: number
  acao_valor: number | null
  ativa: boolean
  criada_em: string
}

// ─── Payloads de entrada ──────────────────────────────────────────────────────

export interface CriarCampanhaPayload {
  campanha_codigo: string
  nome: string
  objetivo: Objetivo
  produto_codigo?: string
  fase?: Fase
  atelie_campanha_ref?: string
  orcamento_total?: number
  janela_avaliacao_h?: number
  gasto_minimo_corte?: number
  adsets: CriarAdsetPayload[]
}

export interface CriarAdsetPayload {
  nome: string
  abordagem?: string
  orcamento_diario: number
  publico_config?: Record<string, unknown>
  ads: CriarAdPayload[]
}

export interface CriarAdPayload {
  nome: string
  video_codigo?: string
  drive_file_id: string
  copy_variante: string
  copy_titulo?: string
  copy_texto: string
}

export interface LancarDoAteliePayload {
  atelie_campanha_id: string          // campanha_id no 02_atelie (ex: 'CP01')
  campanha_codigo: string             // código interno (ex: 'cp01-f2-2026-04')
  nome: string                        // nome da campanha no Meta
  objetivo: Objetivo
  fase?: Fase
  orcamento_diario: number            // mesmo valor para todos os adsets
  janela_avaliacao_h?: number
  gasto_minimo_corte?: number
  publico_config?: Record<string, unknown>
  filtros?: {
    abordagem_codigo?: string
    bloco?: string
    max_videos?: number
  }
}

// ─── Resposta do Meta API ─────────────────────────────────────────────────────

export interface MetaApiResponse<T = unknown> {
  id?: string
  data?: T[]
  error?: {
    message: string
    type: string
    code: number
  }
}
