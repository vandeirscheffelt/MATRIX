import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'

const configSchema = z.object({
  orcamento_diario_padrao: z.number().positive(),
  objetivo: z.enum(['MESSAGES', 'CONVERSIONS']),
  publico_config: z.record(z.unknown()),
  janela_avaliacao_h: z.number().int().positive(),
  gasto_minimo_corte: z.number().positive(),
  mensagem_padrao: z.string().min(1),
})

export async function configuracoesRoutes(app: FastifyInstance) {
  // GET /configuracoes
  app.get('/configuracoes', async () => {
    const { data, error } = await supabase
      .from('configuracoes')
      .select('*')
      .eq('id', 1)
      .single()
    if (error) throw error
    return data
  })

  // PUT /configuracoes
  app.put('/configuracoes', async (req) => {
    const body = configSchema.parse(req.body)
    const { data, error } = await supabase
      .from('configuracoes')
      .upsert({ id: 1, ...body, atualizado_em: new Date().toISOString() })
      .select()
      .single()
    if (error) throw error
    return data
  })
}
