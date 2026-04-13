import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { marcarVideoComoExecutado } from '../lib/atelie.js'
import { baixarVideoDoDrive } from '../lib/drive.js'
import {
  criarCampanhaMeta,
  criarAdsetMeta,
  uploadVideoMeta,
  criarCreativeMeta,
  criarAdMeta,
} from '../lib/meta.js'
import pino from 'pino'

const log = pino({ name: 'lancamentos' })

// ─── Tipos SSE ────────────────────────────────────────────────────────────────

type SseEvento =
  | { tipo: 'inicio';       total_videos: number; total_abordagens: number }
  | { tipo: 'abordagem';    abordagem: string; total: number }
  | { tipo: 'video';        video_codigo: string; etapa: string }
  | { tipo: 'video_ok';     video_codigo: string; meta_ad_id: string }
  | { tipo: 'video_erro';   video_codigo: string; erro: string }
  | { tipo: 'abordagem_ok'; abordagem: string; meta_adset_id: string }
  | { tipo: 'concluido';    campanha_id: string; videos_lancados: number; erros: number }
  | { tipo: 'erro_fatal';   erro: string }

// ─── GET /lancamentos/pendentes — preview de vídeos por campanha/abordagem ────

export async function lancamentosRoutes(app: FastifyInstance) {
  app.get('/lancamentos/pendentes', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
      db: { schema: '02_atelie' },
    })

    const { data: videos, error: err } = await sb
      .from('videos')
      .select('campanha_id, abordagem_codigo, video_codigo, status_execucao, plataforma_tipo, drive_file_id')
      .eq('plataforma_tipo', 'META_ADS')
      .not('drive_file_id', 'is', null)
      .in('status_execucao', ['planejado'])

    if (err) throw err

    // Agrupa: campanha → abordagem → vídeos
    const agrupado: Record<string, Record<string, { total: number; codigos: string[] }>> = {}
    for (const v of videos ?? []) {
      if (!agrupado[v.campanha_id]) agrupado[v.campanha_id] = {}
      if (!agrupado[v.campanha_id][v.abordagem_codigo]) {
        agrupado[v.campanha_id][v.abordagem_codigo] = { total: 0, codigos: [] }
      }
      agrupado[v.campanha_id][v.abordagem_codigo].total++
      agrupado[v.campanha_id][v.abordagem_codigo].codigos.push(v.video_codigo)
    }

    return agrupado
  })

  // ─── POST /lancamentos — lança por abordagem específica com SSE ─────────────
  app.post('/lancamentos', async (req, reply) => {
    const bodySchema = z.object({
      campanha_id_atelie: z.string(),
      abordagem_codigo: z.string(),
      campanha_codigo: z.string(),
      nome: z.string(),
      objetivo: z.enum(['MESSAGES', 'CONVERSIONS']).optional(),
      forcar_relancamento: z.boolean().default(false),
      estrutura: z.enum(['1-1-8', '1-8-8']).default('1-1-8'),
    })

    const body = bodySchema.parse(req.body)

    // Cabeçalhos SSE
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    reply.raw.setHeader('Access-Control-Allow-Origin', '*')
    reply.hijack()

    const enviar = (evento: SseEvento) => {
      reply.raw.write(`data: ${JSON.stringify(evento)}\n\n`)
    }

    try {
      // 1. Carrega configuração global
      const { data: config, error: cfgErr } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('id', 1)
        .single()
      if (cfgErr || !config) throw new Error('Configurações não encontradas')

      // 2. Busca vídeos do ateliê
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false },
        db: { schema: '02_atelie' },
      })

      let query = sb
        .from('videos')
        .select('*')
        .eq('campanha_id', body.campanha_id_atelie)
        .eq('abordagem_codigo', body.abordagem_codigo)
        .eq('plataforma_tipo', 'META_ADS')
        .not('drive_file_id', 'is', null)

      if (!body.forcar_relancamento) {
        query = query.in('status_execucao', ['planejado'])
      }

      const { data: videos, error: vidErr } = await query
      if (vidErr) throw new Error(vidErr.message)
      if (!videos || videos.length === 0) {
        enviar({ tipo: 'erro_fatal', erro: `Nenhum vídeo pendente para ${body.abordagem_codigo}` })
        reply.raw.end()
        return
      }

      enviar({ tipo: 'inicio', total_videos: videos.length, total_abordagens: 1 })

      // 3. Cria campanha no Meta
      enviar({ tipo: 'abordagem', abordagem: body.abordagem_codigo, total: videos.length })

      const metaCampaignId = await criarCampanhaMeta({
        nome: body.nome,
        objetivo: body.objetivo ?? config.objetivo,
      })

      // Persiste campanha no Supabase
      const { data: campanha, error: campErr } = await supabase
        .from('campanhas')
        .insert({
          campanha_codigo: body.campanha_codigo,
          nome: body.nome,
          objetivo: body.objetivo ?? config.objetivo,
          atelie_campanha_ref: body.campanha_id_atelie,
          janela_avaliacao_h: config.janela_avaliacao_h,
          gasto_minimo_corte: config.gasto_minimo_corte,
          meta_campaign_id: metaCampaignId,
          status: 'ativa',
          publicada_em: new Date().toISOString(),
        })
        .select()
        .single()
      if (campErr || !campanha) throw new Error(`Erro ao persistir campanha: ${campErr?.message}`)

      // Helper: processa um vídeo e cria creative + ad em um adset
      async function processarVideo(video: Record<string, string>, adsetId: string, metaAdsetId: string) {
        enviar({ tipo: 'video', video_codigo: video.video_codigo, etapa: 'download_drive' })
        const videoBuffer = await baixarVideoDoDrive(video.drive_file_id)

        enviar({ tipo: 'video', video_codigo: video.video_codigo, etapa: 'upload_meta' })
        const metaVideoId = await uploadVideoMeta({
          fileBuffer: videoBuffer,
          fileName: `${video.video_codigo}.mp4`,
        })

        const mensagemWhatsApp = video.mensagem_wpp ?? `${config.mensagem_padrao} - ${video.video_codigo}`

        enviar({ tipo: 'video', video_codigo: video.video_codigo, etapa: 'creative' })
        const metaCreativeId = await criarCreativeMeta({
          nome: `${video.video_codigo}_creative`,
          metaVideoId,
          titulo: video.headline ?? video.video_codigo,
          copyTexto: video.primary_text ?? mensagemWhatsApp,
          whatsappNumero: process.env.WHATSAPP_NUMBER ?? '',
          mensagemPreenchida: mensagemWhatsApp,
          campanhaCodigo: body.campanha_codigo,
        })

        enviar({ tipo: 'video', video_codigo: video.video_codigo, etapa: 'ad' })
        const metaAdId = await criarAdMeta({
          adsetMetaId: metaAdsetId,
          creativeMetaId: metaCreativeId,
          nome: `${video.video_codigo}_ad`,
        })

        await supabase.from('ads').insert({
          adset_id: adsetId,
          nome: `${video.video_codigo}_ad`,
          video_codigo: video.video_codigo,
          drive_file_id: video.drive_file_id,
          copy_texto: video.primary_text,
          meta_ad_id: metaAdId,
          meta_creative_id: metaCreativeId,
          meta_video_id: metaVideoId,
          status: 'ativa',
        })

        await marcarVideoComoExecutado(video.video_codigo, metaAdId)
        return metaAdId
      }

      let lancados = 0
      let erros = 0

      if (body.estrutura === '1-1-8') {
        // ── Modo 1-1-8: 1 AdSet compartilhado, todos os vídeos como ads ──────
        const metaAdsetId = await criarAdsetMeta({
          campanhaMeta_id: metaCampaignId,
          nome: `${body.campanha_codigo}_${body.abordagem_codigo}`,
          orcamentoDiario: config.orcamento_diario_padrao,
          publicoConfig: config.publico_config,
        })
        const { data: adset, error: adsetErr } = await supabase
          .from('adsets')
          .insert({
            campanha_id: campanha.id,
            nome: `${body.campanha_codigo}_${body.abordagem_codigo}`,
            abordagem: body.abordagem_codigo,
            orcamento_diario: config.orcamento_diario_padrao,
            publico_config: config.publico_config,
            meta_adset_id: metaAdsetId,
            status: 'ativa',
          })
          .select().single()
        if (adsetErr || !adset) throw new Error(`Erro ao persistir adset: ${adsetErr?.message}`)

        enviar({ tipo: 'abordagem', abordagem: body.abordagem_codigo, total: videos.length })

        for (const video of videos) {
          try {
            const metaAdId = await processarVideo(video as Record<string, string>, adset.id, metaAdsetId)
            lancados++
            enviar({ tipo: 'video_ok', video_codigo: video.video_codigo, meta_ad_id: metaAdId })
          } catch (err: unknown) {
            erros++
            const msg = err instanceof Error ? err.message : String(err)
            log.error({ video: video.video_codigo, err: msg }, 'Erro ao lançar vídeo')
            enviar({ tipo: 'video_erro', video_codigo: video.video_codigo, erro: msg })
          }
        }
        enviar({ tipo: 'abordagem_ok', abordagem: body.abordagem_codigo, meta_adset_id: metaAdsetId })

      } else {
        // ── Modo 1-8-8: 1 AdSet por vídeo, 1 ad cada ─────────────────────────
        for (const video of videos) {
          const adsetNome = `${body.campanha_codigo}_${video.video_codigo}`
          try {
            enviar({ tipo: 'abordagem', abordagem: adsetNome, total: 1 })

            const metaAdsetId = await criarAdsetMeta({
              campanhaMeta_id: metaCampaignId,
              nome: adsetNome,
              orcamentoDiario: config.orcamento_diario_padrao,
              publicoConfig: config.publico_config,
            })
            const { data: adset, error: adsetErr } = await supabase
              .from('adsets')
              .insert({
                campanha_id: campanha.id,
                nome: adsetNome,
                abordagem: body.abordagem_codigo,
                orcamento_diario: config.orcamento_diario_padrao,
                publico_config: config.publico_config,
                meta_adset_id: metaAdsetId,
                status: 'ativa',
              })
              .select().single()
            if (adsetErr || !adset) throw new Error(`Erro ao persistir adset: ${adsetErr?.message}`)

            const metaAdId = await processarVideo(video as Record<string, string>, adset.id, metaAdsetId)
            lancados++
            enviar({ tipo: 'video_ok', video_codigo: video.video_codigo, meta_ad_id: metaAdId })
            enviar({ tipo: 'abordagem_ok', abordagem: adsetNome, meta_adset_id: metaAdsetId })
          } catch (err: unknown) {
            erros++
            const msg = err instanceof Error ? err.message : String(err)
            log.error({ video: video.video_codigo, err: msg }, 'Erro ao lançar vídeo')
            enviar({ tipo: 'video_erro', video_codigo: video.video_codigo, erro: msg })
          }
        }
      }

      enviar({ tipo: 'concluido', campanha_id: campanha.id, videos_lancados: lancados, erros })

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error({ err: msg }, 'Erro fatal no lançamento')
      enviar({ tipo: 'erro_fatal', erro: msg })
    }

    reply.raw.end()
  })
}
