import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { lancarCampanha, lancarCampanhaDoAtelie } from '../services/launcher.js'
import { atualizarStatusAd, atualizarOrcamentoAdset } from '../lib/meta.js'

const criarAdSchema = z.object({
  nome: z.string(),
  video_codigo: z.string().optional(),
  drive_file_id: z.string(),
  copy_variante: z.enum(['T1', 'T2', 'T3']),
  copy_texto: z.string(),
})

const criarAdsetSchema = z.object({
  nome: z.string(),
  abordagem: z.string().optional(),
  orcamento_diario: z.number().positive(),
  publico_config: z.record(z.unknown()).optional(),
  ads: z.array(criarAdSchema).min(1),
})

const criarCampanhaSchema = z.object({
  campanha_codigo: z.string(),
  nome: z.string(),
  objetivo: z.enum(['MESSAGES', 'CONVERSIONS']),
  produto_codigo: z.string().optional(),
  fase: z.enum(['F2', 'F3', 'F4']).optional(),
  atelie_campanha_ref: z.string().optional(),
  orcamento_total: z.number().optional(),
  janela_avaliacao_h: z.number().default(72),
  gasto_minimo_corte: z.number().default(10),
  adsets: z.array(criarAdsetSchema).min(1),
})

export async function campanhasRoutes(app: FastifyInstance) {
  // GET /campanhas — lista campanhas com resumo
  app.get('/campanhas', async () => {
    const { data, error } = await supabase
      .from('campanhas')
      .select('*')
      .order('criada_em', { ascending: false })

    if (error) throw error
    return data
  })

  // GET /campanhas/:id — detalhe + adsets + ads
  app.get<{ Params: { id: string } }>('/campanhas/:id', async (req) => {
    const { data: campanha, error } = await supabase
      .from('campanhas')
      .select('*, adsets(*, ads(*))')
      .eq('id', req.params.id)
      .single()

    if (error) throw error
    return campanha
  })

  // POST /campanhas/atelie — lança campanha buscando vídeos do 02_atelie
  app.post('/campanhas/atelie', async (req, reply) => {
    const schema = z.object({
      atelie_campanha_id: z.string(),
      campanha_codigo: z.string(),
      nome: z.string(),
      objetivo: z.enum(['MESSAGES', 'CONVERSIONS']),
      fase: z.enum(['F2', 'F3', 'F4']).optional(),
      orcamento_diario: z.number().positive(),
      janela_avaliacao_h: z.number().default(72),
      gasto_minimo_corte: z.number().default(10),
      publico_config: z.record(z.unknown()).optional(),
      filtros: z.object({
        abordagem_codigo: z.string().optional(),
        bloco: z.string().optional(),
        max_videos: z.number().optional(),
      }).optional(),
    })
    const payload = schema.parse(req.body)
    try {
      const campanhaId = await lancarCampanhaDoAtelie(payload)
      return reply.code(201).send({ id: campanhaId })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(422).send({ error: 'LauncherError', message: msg })
    }
  })

  // POST /campanhas — cria rascunho + lança no Meta
  app.post('/campanhas', async (req, reply) => {
    const payload = criarCampanhaSchema.parse(req.body)
    try {
      const campanhaId = await lancarCampanha(payload)
      return reply.code(201).send({ id: campanhaId })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.code(422).send({ error: 'LauncherError', message: msg })
    }
  })

  // PATCH /campanhas/:id/status — pausa ou ativa campanha manualmente
  app.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/campanhas/:id/status',
    async (req) => {
      const { status } = z.object({ status: z.enum(['ativa', 'pausada', 'arquivada']) }).parse(req.body)
      const { data, error } = await supabase
        .from('campanhas')
        .update({ status, atualizada_em: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single()

      if (error) throw error
      return data
    }
  )

  // GET /campanhas/:id/metricas — métricas diárias
  app.get<{ Params: { id: string }; Querystring: { dias?: string } }>(
    '/campanhas/:id/metricas',
    async (req) => {
      const dias = Number(req.query.dias ?? 7)
      const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10)

      const { data, error } = await supabase
        .from('metricas_diarias')
        .select('*')
        .eq('campanha_id', req.params.id)
        .gte('data_referencia', desde)
        .order('data_referencia', { ascending: true })

      if (error) throw error
      return data
    }
  )

  // GET /campanhas/:id/log — histórico do scaler
  app.get<{ Params: { id: string } }>('/campanhas/:id/log', async (req) => {
    const { data, error } = await supabase
      .from('scaler_log')
      .select('*')
      .eq('campanha_id', req.params.id)
      .order('executado_em', { ascending: false })
      .limit(100)

    if (error) throw error
    return data
  })

  // PATCH /ads/:id/status — pausa/ativa ad individual
  app.patch<{ Params: { id: string }; Body: { status: string } }>(
    '/ads/:id/status',
    async (req) => {
      const { status } = z.object({ status: z.enum(['ativa', 'pausada']) }).parse(req.body)

      const { data: ad, error } = await supabase
        .from('ads')
        .select('meta_ad_id')
        .eq('id', req.params.id)
        .single()

      if (error || !ad) throw error ?? new Error('Ad não encontrado')

      if (ad.meta_ad_id) {
        await atualizarStatusAd(ad.meta_ad_id, status === 'ativa' ? 'ACTIVE' : 'PAUSED')
      }

      const { data: updated } = await supabase
        .from('ads')
        .update({ status })
        .eq('id', req.params.id)
        .select()
        .single()

      return updated
    }
  )

  // PATCH /adsets/:id/orcamento — ajuste manual de orçamento
  app.patch<{ Params: { id: string }; Body: { orcamento_diario: number } }>(
    '/adsets/:id/orcamento',
    async (req) => {
      const { orcamento_diario } = z.object({ orcamento_diario: z.number().positive() }).parse(req.body)

      const { data: adset, error } = await supabase
        .from('adsets')
        .select('meta_adset_id')
        .eq('id', req.params.id)
        .single()

      if (error || !adset) throw error ?? new Error('AdSet não encontrado')

      if (adset.meta_adset_id) {
        await atualizarOrcamentoAdset(adset.meta_adset_id, orcamento_diario)
      }

      const { data: updated } = await supabase
        .from('adsets')
        .update({ orcamento_diario })
        .eq('id', req.params.id)
        .select()
        .single()

      return updated
    }
  )

  // GET /regras/:campanha_id — lista regras do scaler
  app.get<{ Params: { campanha_id: string } }>('/regras/:campanha_id', async (req) => {
    const { data, error } = await supabase
      .from('regras_scaler')
      .select('*')
      .eq('campanha_id', req.params.campanha_id)

    if (error) throw error
    return data
  })

  // POST /regras — cria regra de scaler
  app.post('/regras', async (req, reply) => {
    const schema = z.object({
      campanha_id: z.string().uuid(),
      tipo: z.enum(['CORTE', 'ESCALA', 'PAUSA']),
      metrica: z.string(),
      operador: z.enum(['gt', 'lt', 'eq']),
      valor: z.number(),
      acao_valor: z.number().optional(),
    })
    const body = schema.parse(req.body)
    const { data, error } = await supabase
      .from('regras_scaler')
      .insert(body)
      .select()
      .single()

    if (error) throw error
    return reply.code(201).send(data)
  })

  // DELETE /campanhas/:id — remove campanha (e adsets/ads em cascata)
  app.delete<{ Params: { id: string } }>('/campanhas/:id', async (req, reply) => {
    const { id } = req.params

    // Cascata manual (caso FK não seja ON DELETE CASCADE)
    const { data: adsets } = await supabase.from('adsets').select('id').eq('campanha_id', id)
    for (const adset of adsets ?? []) {
      await supabase.from('ads').delete().eq('adset_id', adset.id)
    }
    await supabase.from('adsets').delete().eq('campanha_id', id)
    const { error } = await supabase.from('campanhas').delete().eq('id', id)

    if (error) throw error
    return reply.code(204).send()
  })

  // DELETE /regras/:id — remove regra
  app.delete<{ Params: { id: string } }>('/regras/:id', async (req, reply) => {
    const { error } = await supabase
      .from('regras_scaler')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    return reply.code(204).send()
  })
}
