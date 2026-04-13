import { supabase } from '../lib/supabase.js'
import { baixarVideoDoDrive } from '../lib/drive.js'
import {
  criarCampanhaMeta,
  criarAdsetMeta,
  uploadVideoMeta,
  criarCreativeMeta,
  criarAdMeta,
} from '../lib/meta.js'
import { buscarVideosParaCampanha, marcarVideoComoExecutado } from '../lib/atelie.js'
import type { CriarCampanhaPayload, LancarDoAteliePayload } from '../types/index.js'
import pino from 'pino'

const log = pino({ name: 'launcher' })

// ─── Lança uma campanha completa no Meta ──────────────────────────────────────

export async function lancarCampanha(payload: CriarCampanhaPayload): Promise<string> {
  log.info({ codigo: payload.campanha_codigo }, 'Iniciando lançamento de campanha')

  // 1. Cria campanha no Meta primeiro
  const metaCampaignId = await criarCampanhaMeta({
    nome: payload.nome,
    objetivo: payload.objetivo,
  })
  log.info({ metaCampaignId }, 'Campanha criada no Meta')

  // 2. Persiste campanha no banco (já com meta_campaign_id)
  const { data: campanha, error: errCampanha } = await supabase
    .from('campanhas')
    .insert({
      campanha_codigo: payload.campanha_codigo,
      nome: payload.nome,
      objetivo: payload.objetivo,
      produto_codigo: payload.produto_codigo,
      fase: payload.fase,
      atelie_campanha_ref: payload.atelie_campanha_ref,
      orcamento_total: payload.orcamento_total,
      janela_avaliacao_h: payload.janela_avaliacao_h ?? 72,
      gasto_minimo_corte: payload.gasto_minimo_corte ?? 10,
      meta_campaign_id: metaCampaignId,
      status: 'ativa',
      publicada_em: new Date().toISOString(),
    })
    .select()
    .single()

  if (errCampanha || !campanha) throw new Error(`Erro ao persistir campanha: ${errCampanha?.message}`)

  // 3. Para cada AdSet
  for (const adsetPayload of payload.adsets) {
    const metaAdsetId = await criarAdsetMeta({
      campanhaMeta_id: metaCampaignId,
      nome: adsetPayload.nome,
      orcamentoDiario: adsetPayload.orcamento_diario,
      publicoConfig: adsetPayload.publico_config,
    })
    log.info({ metaAdsetId, adset: adsetPayload.nome }, 'AdSet criado no Meta')

    const { data: adset, error: errAdset } = await supabase
      .from('adsets')
      .insert({
        campanha_id: campanha.id,
        nome: adsetPayload.nome,
        abordagem: adsetPayload.abordagem,
        orcamento_diario: adsetPayload.orcamento_diario,
        publico_config: adsetPayload.publico_config,
        meta_adset_id: metaAdsetId,
        status: 'ativa',
      })
      .select()
      .single()

    if (errAdset || !adset) throw new Error(`Erro ao persistir adset: ${errAdset?.message}`)

    // 4. Para cada anúncio
    for (const adPayload of adsetPayload.ads) {
      log.info({ ad: adPayload.nome }, 'Processando anúncio')

      const videoBuffer = await baixarVideoDoDrive(adPayload.drive_file_id)
      const fileName = `${adPayload.video_codigo ?? adPayload.nome}.mp4`
      const metaVideoId = await uploadVideoMeta({ fileBuffer: videoBuffer, fileName })

      const carimboCodigo = adPayload.video_codigo
        ? `${adPayload.video_codigo}|${adPayload.copy_variante}`
        : adPayload.nome

      const metaCreativeId = await criarCreativeMeta({
        nome: `${adPayload.nome}_creative`,
        metaVideoId,
        titulo: adPayload.copy_titulo ?? adPayload.nome,
        copyTexto: adPayload.copy_texto,
        whatsappNumero: process.env.WHATSAPP_NUMBER ?? '',
        mensagemPreenchida: carimboCodigo,
      })

      const metaAdId = await criarAdMeta({
        adsetMetaId: metaAdsetId,
        creativeMetaId: metaCreativeId,
        nome: adPayload.nome,
      })

      const { error: errAd } = await supabase
        .from('ads')
        .insert({
          adset_id: adset.id,
          nome: adPayload.nome,
          video_codigo: adPayload.video_codigo,
          drive_file_id: adPayload.drive_file_id,
          copy_variante: adPayload.copy_variante,
          copy_texto: adPayload.copy_texto,
          meta_ad_id: metaAdId,
          meta_creative_id: metaCreativeId,
          meta_video_id: metaVideoId,
          status: 'ativa',
        })

      if (errAd) throw new Error(`Erro ao persistir ad: ${errAd.message}`)
      log.info({ metaAdId, ad: adPayload.nome }, 'Anúncio criado no Meta')
    }
  }

  log.info({ campanhaId: campanha.id }, 'Lançamento concluído')
  return campanha.id
}

// ─── Lança campanha buscando vídeos do 02_atelie ─────────────────────────────

export async function lancarCampanhaDoAtelie(payload: LancarDoAteliePayload): Promise<string> {
  log.info({ atelie_campanha_id: payload.atelie_campanha_id }, 'Buscando vídeos do ateliê')

  // 1. Busca vídeos prontos no ateliê
  const videos = await buscarVideosParaCampanha(payload.atelie_campanha_id, payload.filtros)
  log.info({ total: videos.length }, 'Vídeos encontrados no ateliê')

  // 2. Agrupa por abordagem_codigo → cada abordagem = 1 AdSet
  const porAbordagem = new Map<string, typeof videos>()
  for (const v of videos) {
    const key = v.abordagem_codigo ?? 'SEM_ABORDAGEM'
    if (!porAbordagem.has(key)) porAbordagem.set(key, [])
    porAbordagem.get(key)!.push(v)
  }

  // 3. Monta adsets para o launcher padrão
  const adsets = [...porAbordagem.entries()].map(([abordagem, vids], adsetIdx) => ({
    nome: `${payload.campanha_codigo}_${abordagem}`,
    abordagem,
    orcamento_diario: payload.orcamento_diario,
    publico_config: payload.publico_config,
    ads: vids.map((v, i) => ({
      nome: `${payload.campanha_codigo}_${v.video_codigo}_T${i + 1}`,
      video_codigo: v.video_codigo,
      drive_file_id: v.drive_file_id,
      copy_variante: `T${i + 1}`,
      copy_titulo: v.headline ?? undefined,
      copy_texto: v.primary_text ?? `${v.video_codigo} — anúncio ${adsetIdx + 1}.${i + 1}`,
    })),
  }))

  // 4. Lança via fluxo padrão
  const campanhaId = await lancarCampanha({
    campanha_codigo: payload.campanha_codigo,
    nome: payload.nome,
    objetivo: payload.objetivo,
    fase: payload.fase,
    atelie_campanha_ref: payload.atelie_campanha_id,
    janela_avaliacao_h: payload.janela_avaliacao_h,
    gasto_minimo_corte: payload.gasto_minimo_corte,
    adsets,
  })

  // 5. Marca todos os vídeos como executados no ateliê
  await Promise.all(
    videos.map((v) => marcarVideoComoExecutado(v.video_codigo, campanhaId))
  )

  log.info({ campanhaId, videosLancados: videos.length }, 'Lançamento do ateliê concluído')
  return campanhaId
}
