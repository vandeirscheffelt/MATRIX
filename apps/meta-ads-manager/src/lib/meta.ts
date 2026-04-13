import axios from 'axios'
import FormData from 'form-data'
import type { MetaApiResponse } from '../types/index.js'

const BASE_URL = 'https://graph.facebook.com/v21.0'

function token() {
  const t = process.env.META_ACCESS_TOKEN
  if (!t) throw new Error('META_ACCESS_TOKEN não configurado')
  return t
}

function adAccountId() {
  const id = process.env.META_AD_ACCOUNT_ID
  if (!id) throw new Error('META_AD_ACCOUNT_ID não configurado')
  return id.startsWith('act_') ? id : `act_${id}`
}

// ─── Campanhas ────────────────────────────────────────────────────────────────

export async function criarCampanhaMeta(params: {
  nome: string
  objetivo: string
  status?: string
}): Promise<string> {
  const body = {
    name: params.nome,
    objective: params.objetivo === 'MESSAGES' ? 'OUTCOME_ENGAGEMENT' : 'OUTCOME_SALES',
    status: params.status ?? 'PAUSED',
    special_ad_categories: [],
    is_adset_budget_sharing_enabled: false,
    access_token: token(),
  }
  console.log('[META] criarCampanha payload:', JSON.stringify({ ...body, access_token: '***' }))
  let res
  try {
    res = await axios.post<MetaApiResponse>(`${BASE_URL}/${adAccountId()}/campaigns`, body)
  } catch (err: unknown) {
    const data = (err as { response?: { data?: unknown } }).response?.data
    console.error('[META] criarCampanha erro:', JSON.stringify(data))
    throw new Error(`Meta API error: ${JSON.stringify(data)}`)
  }
  if (res.data.error) throw new Error(res.data.error.message)
  return res.data.id!
}

// ─── AdSets ───────────────────────────────────────────────────────────────────

export async function criarAdsetMeta(params: {
  campanhaMeta_id: string
  nome: string
  orcamentoDiario: number
  publicoConfig?: Record<string, unknown>
}): Promise<string> {
  const orcamentoCentavos = Math.round(params.orcamentoDiario * 100)
  const body = {
    name: params.nome,
    campaign_id: params.campanhaMeta_id,
    daily_budget: orcamentoCentavos,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'CONVERSATIONS',
    destination_type: 'WHATSAPP',
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { page_id: process.env.META_PAGE_ID },
    status: 'PAUSED',
    targeting: (() => {
      const config = params.publicoConfig ?? {
        geo_locations: { countries: ['BR'] },
        age_min: 18,
        age_max: 65,
      }
      // Remove campos de referência interna que não são válidos na Meta API
      const { interests_note, ...targeting } = config as Record<string, unknown>
      void interests_note
      return { ...targeting, targeting_automation: { advantage_audience: 0 } }
    })(),
    access_token: token(),
  }
  console.log('[META] criarAdset payload:', JSON.stringify({ ...body, access_token: '***' }))
  let res
  try {
    res = await axios.post<MetaApiResponse>(`${BASE_URL}/${adAccountId()}/adsets`, body)
  } catch (err: unknown) {
    const data = (err as { response?: { data?: unknown } }).response?.data
    console.error('[META] criarAdset erro:', JSON.stringify(data))
    throw new Error(`Meta API error: ${JSON.stringify(data)}`)
  }
  if (res.data.error) throw new Error(res.data.error.message)
  return res.data.id!
}

// ─── Vídeo ────────────────────────────────────────────────────────────────────

export async function uploadVideoMeta(params: {
  fileBuffer: Buffer
  fileName: string
}): Promise<string> {
  const sizeMB = (params.fileBuffer.length / (1024 * 1024)).toFixed(2)
  console.log(`[META] Fazendo upload de vídeo: ${params.fileName} (${sizeMB} MB)`)

  const form = new FormData()
  form.append('source', params.fileBuffer, { filename: params.fileName })
  form.append('access_token', token())

  let res
  try {
    res = await axios.post<MetaApiResponse>(
      `${BASE_URL}/${adAccountId()}/advideos`,
      form,
      {
        headers: form.getHeaders(),
        // Timeout de 10 minutos para uploads grandes
        timeout: 10 * 60 * 1000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    )
  } catch (err: unknown) {
    const data = (err as { response?: { data?: unknown } }).response?.data
    console.error('[META] uploadVideo erro:', JSON.stringify(data))
    throw new Error(`Meta API upload error: ${JSON.stringify(data)}`)
  }
  if (res.data.error) throw new Error(res.data.error.message)

  const videoId = res.data.id!
  console.log(`[META] Vídeo enviado com ID: ${videoId}. Aguardando processamento...`)

  // Aguarda a Meta processar o vídeo antes de continuar
  await aguardarProcessamentoVideo(videoId)

  return videoId
}

// ─── Aguardar processamento do vídeo ──────────────────────────────────────────

async function aguardarProcessamentoVideo(
  metaVideoId: string,
  maxTentativas = 60,       // 60 x 5s = 5 minutos
  intervaloMs = 5_000
): Promise<void> {
  for (let i = 1; i <= maxTentativas; i++) {
    const res = await axios.get<{ status?: { video_status?: string } }>(
      `${BASE_URL}/${metaVideoId}`,
      { params: { fields: 'status', access_token: token() } }
    )

    const status = res.data.status?.video_status
    console.log(`[META] Vídeo ${metaVideoId} — status: ${status ?? 'unknown'} (tentativa ${i}/${maxTentativas})`)

    if (status === 'ready') {
      console.log(`[META] Vídeo ${metaVideoId} processado com sucesso!`)
      return
    }

    if (status === 'error') {
      throw new Error(
        `Meta reportou erro ao processar o vídeo ${metaVideoId}. Verifique o formato e codec do arquivo.`
      )
    }

    // Status 'processing' ou outro — aguarda
    await new Promise(resolve => setTimeout(resolve, intervaloMs))
  }

  throw new Error(
    `Timeout: vídeo ${metaVideoId} não ficou pronto após ${maxTentativas * intervaloMs / 1000}s`
  )
}

// ─── Thumbnail do vídeo ───────────────────────────────────────────────────────

export async function buscarThumbnailVideo(metaVideoId: string): Promise<string> {
  // Tenta /thumbnails primeiro (disponível após processamento)
  const res = await axios.get<{
    thumbnails?: { data?: { uri: string; is_preferred?: boolean }[] }
    picture?: string
  }>(
    `${BASE_URL}/${metaVideoId}`,
    { params: { fields: 'thumbnails,picture', access_token: token() } }
  )
  const thumbs = res.data.thumbnails?.data ?? []
  const preferred = thumbs.find(t => t.is_preferred) ?? thumbs[0]
  if (preferred?.uri) return preferred.uri
  if (res.data.picture) return res.data.picture
  throw new Error(`Nenhum thumbnail encontrado para vídeo ${metaVideoId}`)
}

// ─── Creative ─────────────────────────────────────────────────────────────────

export async function criarCreativeMeta(params: {
  nome: string
  metaVideoId: string
  titulo: string
  copyTexto: string
  whatsappNumero: string
  mensagemPreenchida: string
  campanhaCodigo?: string
}): Promise<string> {
  const imageUrl = await buscarThumbnailVideo(params.metaVideoId)
  const body = {
    name: params.nome,
    object_story_spec: {
      page_id: process.env.META_PAGE_ID,
      video_data: {
        video_id: params.metaVideoId,
        image_url: imageUrl,
        title: params.titulo,
        message: params.copyTexto,
        call_to_action: {
          type: 'WHATSAPP_MESSAGE',
          value: {
            app_destination: 'WHATSAPP',
            link: `https://wa.me/${params.whatsappNumero.replace(/\D/g, '')}?text=${encodeURIComponent(params.mensagemPreenchida)}`,
          },
        },
      },
    },
    url_tags: `utm_source=meta&utm_medium=paid&utm_campaign=${params.campanhaCodigo ?? params.nome}`,
    access_token: token(),
  }
  console.log('[META] criarCreative payload:', JSON.stringify({ ...body, access_token: '***' }))
  let res
  try {
    res = await axios.post<MetaApiResponse>(`${BASE_URL}/${adAccountId()}/adcreatives`, body)
  } catch (err: unknown) {
    const data = (err as { response?: { data?: unknown } }).response?.data
    console.error('[META] criarCreative erro:', JSON.stringify(data))
    throw new Error(`Meta API error: ${JSON.stringify(data)}`)
  }
  if (res.data.error) throw new Error(res.data.error.message)
  return res.data.id!
}

// ─── Anúncio ──────────────────────────────────────────────────────────────────

export async function criarAdMeta(params: {
  adsetMetaId: string
  creativeMetaId: string
  nome: string
}): Promise<string> {
  const body = {
    name: params.nome,
    adset_id: params.adsetMetaId,
    creative: { creative_id: params.creativeMetaId },
    status: 'PAUSED',
    access_token: token(),
  }
  console.log('[META] criarAd payload:', JSON.stringify({ ...body, access_token: '***' }))
  let res
  try {
    res = await axios.post<MetaApiResponse>(`${BASE_URL}/${adAccountId()}/ads`, body)
  } catch (err: unknown) {
    const data = (err as { response?: { data?: unknown } }).response?.data
    console.error('[META] criarAd erro:', JSON.stringify(data))
    throw new Error(`Meta API error: ${JSON.stringify(data)}`)
  }
  if (res.data.error) throw new Error(res.data.error.message)
  return res.data.id!
}

// ─── Métricas ─────────────────────────────────────────────────────────────────

export async function buscarMetricasAds(
  adIds: string[],
  dataInicio: string,
  dataFim: string
): Promise<Record<string, unknown>[]> {
  const res = await axios.get<MetaApiResponse<Record<string, unknown>>>(
    `${BASE_URL}/${adAccountId()}/insights`,
    {
      params: {
        level: 'ad',
        fields: 'ad_id,impressions,clicks,spend,ctr,cpm,actions',
        filtering: JSON.stringify([{ field: 'ad.id', operator: 'IN', value: adIds }]),
        time_range: JSON.stringify({ since: dataInicio, until: dataFim }),
        access_token: token(),
        limit: 500,
      },
    }
  )
  return res.data.data ?? []
}

// ─── Controle de status ───────────────────────────────────────────────────────

export async function atualizarStatusAd(
  metaAdId: string,
  status: 'ACTIVE' | 'PAUSED'
): Promise<void> {
  await axios.post(`${BASE_URL}/${metaAdId}`, {
    status,
    access_token: token(),
  })
}

export async function atualizarOrcamentoAdset(
  metaAdsetId: string,
  novoOrcamentoDiario: number
): Promise<void> {
  await axios.post(`${BASE_URL}/${metaAdsetId}`, {
    daily_budget: Math.round(novoOrcamentoDiario * 100),
    access_token: token(),
  })
}
