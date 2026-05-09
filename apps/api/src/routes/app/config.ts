import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const configBody = z.object({
  prompt: z.string().min(1).optional(),
  tom: z.enum(['FORMAL', 'INFORMAL']).optional(),
  palavraPausa: z.string().optional(),
  palavraRetorno: z.string().optional(),
  tempoRetornoMin: z.number().int().positive().nullable().optional(),
  faq: z.array(z.object({ pergunta: z.string(), resposta: z.string() })).optional(),
  botAtivo: z.boolean().optional(),
})

const gerarPromptBody = z.object({
  tipoNegocio: z.string().min(1),
  nomeEmpresa: z.string().min(1),
  descricao: z.string().optional(),
})

export async function configRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/config
  app.get('/', { preHandler }, async (request: any, reply) => {
    const config = await prisma.configBot.findUnique({
      where: { empresaId: request.empresaId },
    })
    if (!config) return reply.code(404).send({ error: 'Config não encontrada' })
    return config
  })

  // PUT /app/config
  app.put('/', { preHandler }, async (request: any, reply) => {
    const body = configBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const config = await prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: {
        empresaId: request.empresaId,
        prompt: body.data.prompt ?? '',
        ...body.data,
      },
      update: body.data,
    })
    return config
  })

  // PATCH /app/config/bot-ativo — toggle rápido do cabeçalho
  app.patch('/bot-ativo', { preHandler }, async (request: any, reply) => {
    const body = z.object({ botAtivo: z.boolean() }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const config = await prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', botAtivo: body.data.botAtivo },
      update: { botAtivo: body.data.botAtivo },
      select: { botAtivo: true },
    })
    return config
  })

  // PATCH /app/config/idioma
  app.patch('/idioma', { preHandler }, async (request: any, reply) => {
    const body = z.object({ idioma: z.string().min(2) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', idioma: body.data.idioma },
      update: { idioma: body.data.idioma },
      select: { idioma: true },
    })
  })

  // PATCH /app/config/tipo-negocio
  app.patch('/tipo-negocio', { preHandler }, async (request: any, reply) => {
    const body = z.object({ tipoNegocio: z.string().min(1) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', tipoNegocio: body.data.tipoNegocio },
      update: { tipoNegocio: body.data.tipoNegocio },
      select: { tipoNegocio: true },
    })
  })

  // PATCH /app/config/contexto-operacional
  app.patch('/contexto-operacional', { preHandler }, async (request: any, reply) => {
    const body = z.object({ contexto: z.string().min(1) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', contextoOperacional: body.data.contexto },
      update: { contextoOperacional: body.data.contexto },
      select: { contextoOperacional: true },
    })
  })

  // POST /app/config/melhorar-contexto — IA reescreve o contexto
  app.post('/melhorar-contexto', { preHandler }, async (request: any, reply) => {
    const config = await prisma.configBot.findUnique({
      where: { empresaId: request.empresaId },
      select: { contextoOperacional: true, tipoNegocio: true },
    })
    if (!config?.contextoOperacional) {
      return reply.code(422).send({ error: 'Nenhum contexto para melhorar' })
    }
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: `Você é um especialista em configuração de assistentes de IA para empresas. Reescreva o contexto operacional de forma clara, profissional e detalhada em português, para ser usado como instrução de um atendente IA via WhatsApp. Tipo de negócio: ${config.tipoNegocio ?? 'não informado'}. IMPORTANTE: retorne SOMENTE o texto reescrito, sem títulos, rótulos, prefixos ou explicações.` },
        { role: 'user', content: config.contextoOperacional },
      ],
    })
    return { contexto: completion.choices[0]?.message?.content ?? '' }
  })

  // PATCH /app/config/tom
  app.patch('/tom', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      tom: z.enum(['FORMAL', 'INFORMAL']).optional(),
      tomDisplay: z.string().min(1).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const data: any = {}
    if (body.data.tom) data.tom = body.data.tom
    if (body.data.tomDisplay !== undefined) data.tomDisplay = body.data.tomDisplay
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', ...data },
      update: data,
      select: { tom: true, tomDisplay: true },
    })
  })

  // PATCH /app/config/nome-assistente
  app.patch('/nome-assistente', { preHandler }, async (request: any, reply) => {
    const body = z.object({ nomeAssistente: z.string().min(1).max(50) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', nomeAssistente: body.data.nomeAssistente },
      update: { nomeAssistente: body.data.nomeAssistente },
      select: { nomeAssistente: true },
    })
  })

  // PATCH /app/config/identidade
  app.patch('/identidade', { preHandler }, async (request: any, reply) => {
    const body = z.object({ identidade: z.enum(['assistente_virtual', 'atendente_humano']) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', identidade: body.data.identidade },
      update: { identidade: body.data.identidade },
      select: { identidade: true },
    })
  })

  // PATCH /app/config/disponibilidade-ia
  app.patch('/disponibilidade-ia', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      disponibilidade: z.enum(['horario_comercial', '24_7', 'personalizado']),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', disponibilidade: body.data.disponibilidade },
      update: { disponibilidade: body.data.disponibilidade },
      select: { disponibilidade: true },
    })
  })

  // PATCH /app/config/horario-comercial
  app.patch('/horario-comercial', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      horarioInicio: z.string().regex(/^\d{2}:\d{2}$/),
      horarioFim: z.string().regex(/^\d{2}:\d{2}$/),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', horarioInicio: body.data.horarioInicio, horarioFim: body.data.horarioFim },
      update: { horarioInicio: body.data.horarioInicio, horarioFim: body.data.horarioFim },
      select: { horarioInicio: true, horarioFim: true },
    })
  })

  // PATCH /app/config/comandos-controle
  app.patch('/comandos-controle', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      palavraPausa: z.string().min(1).optional(),
      palavraRetorno: z.string().min(1).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', ...body.data },
      update: body.data,
      select: { palavraPausa: true, palavraRetorno: true },
    })
  })

  // PATCH /app/config/auto-retomada
  app.patch('/auto-retomada', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      tempoRetornoMin: z.number().int().positive().nullable(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', tempoRetornoMin: body.data.tempoRetornoMin },
      update: { tempoRetornoMin: body.data.tempoRetornoMin },
      select: { tempoRetornoMin: true },
    })
  })

  // PATCH /app/config/confirmacao-antecedencia
  app.patch('/confirmacao-antecedencia', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      confirmacaoAntecedenciaHoras: z.number().int().min(1).max(48),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', confirmacaoAntecedenciaHoras: body.data.confirmacaoAntecedenciaHoras },
      update: { confirmacaoAntecedenciaHoras: body.data.confirmacaoAntecedenciaHoras },
      select: { confirmacaoAntecedenciaHoras: true },
    })
  })

  // POST /app/config/gerar-prompt — IA gera prompt com base no tipo de negócio
  app.post('/gerar-prompt', { preHandler }, async (request: any, reply) => {
    const body = gerarPromptBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { tipoNegocio, nomeEmpresa, descricao } = body.data

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um especialista em criar prompts para atendentes IA de WhatsApp focados em agendamento.
Crie um system prompt completo, profissional e em português brasileiro para um atendente virtual.
O prompt deve incluir: persona, objetivo, tom, regras de agendamento, e instruções de escalada para humano.
Retorne APENAS o prompt, sem explicações adicionais.`,
        },
        {
          role: 'user',
          content: `Tipo de negócio: ${tipoNegocio}
Nome da empresa: ${nomeEmpresa}
${descricao ? `Descrição adicional: ${descricao}` : ''}`,
        },
      ],
    })

    const prompt = completion.choices[0]?.message?.content ?? ''
    return { prompt }
  })
}
