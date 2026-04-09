import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'

// Segredo compartilhado entre Fastify e n8n
function requireWebhookSecret(request: any, reply: any) {
  const secret = request.headers['x-webhook-secret']
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
}

const agendamentoBody = z.object({
  empresaId: z.string().uuid(),
  leadTelefone: z.string(),
  leadNome: z.string().optional(),
  profissionalId: z.string().uuid(),
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
})

const conversaBody = z.object({
  empresaId: z.string().uuid(),
  telefone: z.string(),
})

export async function n8nWebhookRoutes(app: FastifyInstance) {
  // GET /webhook/n8n/config/:empresa_id
  // n8n busca configs para injetar no agente IA
  app.get('/config/:empresaId', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }

    const [config, profissionais] = await Promise.all([
      prisma.configBot.findUnique({ where: { empresaId } }),
      prisma.profissional.findMany({
        where: { empresaId, ativo: true },
        select: { id: true, nome: true, duracaoPadraoMin: true },
      }),
    ])

    if (!config) return reply.code(404).send({ error: 'Config não encontrada' })

    return {
      prompt: config.prompt,
      tom: config.tom,
      palavraPausa: config.palavraPausa,
      palavraRetorno: config.palavraRetorno,
      tempoRetornoMin: config.tempoRetornoMin,
      faq: config.faq,
      botAtivo: config.botAtivo,
      profissionais,
    }
  })

  // POST /webhook/n8n/agendamento
  // n8n chama quando IA confirma um agendamento
  app.post('/agendamento', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = agendamentoBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, leadTelefone, leadNome, profissionalId, inicio, fim } = body.data
    const inicioDate = new Date(inicio)
    const fimDate = new Date(fim)

    // Verifica conflito
    const conflito = await prisma.agendamento.findFirst({
      where: {
        profissionalId,
        status: { in: ['CONFIRMADO', 'REMARCADO'] },
        OR: [{ inicio: { lt: fimDate }, fim: { gt: inicioDate } }],
      },
    })
    if (conflito) return reply.code(409).send({ error: 'Horário em conflito' })

    // Upsert do lead
    const lead = await prisma.lead.upsert({
      where: { empresaId_telefone: { empresaId, telefone: leadTelefone } },
      create: { empresaId, telefone: leadTelefone, nomeWpp: leadNome },
      update: { nomeWpp: leadNome },
    })

    const agendamento = await prisma.agendamento.create({
      data: { empresaId, profissionalId, leadId: lead.id, inicio: inicioDate, fim: fimDate },
    })

    return { success: true, agendamentoId: agendamento.id }
  })

  // POST /webhook/n8n/conversa/pausar
  app.post('/conversa/pausar', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = conversaBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, telefone } = body.data

    // Busca config para saber se usa tempo automático
    const config = await prisma.configBot.findUnique({
      where: { empresaId },
      select: { tempoRetornoMin: true },
    })

    const lead = await prisma.lead.findUnique({
      where: { empresaId_telefone: { empresaId, telefone } },
    })
    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' })

    const retornoEm = config?.tempoRetornoMin
      ? new Date(Date.now() + config.tempoRetornoMin * 60_000)
      : null

    await prisma.conversa.upsert({
      where: { leadId: lead.id },
      create: {
        leadId: lead.id,
        empresaId,
        statusIa: 'PAUSADO',
        pausadoEm: new Date(),
        retornoEm,
      },
      update: { statusIa: 'PAUSADO', pausadoEm: new Date(), retornoEm },
    })

    return { success: true, retornoEm }
  })

  // POST /webhook/n8n/conversa/reativar
  app.post('/conversa/reativar', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = conversaBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, telefone } = body.data

    const lead = await prisma.lead.findUnique({
      where: { empresaId_telefone: { empresaId, telefone } },
    })
    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' })

    await prisma.conversa.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id, empresaId, statusIa: 'ATIVO' },
      update: { statusIa: 'ATIVO', pausadoEm: null, retornoEm: null },
    })

    return { success: true }
  })
}
