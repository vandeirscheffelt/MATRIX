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
      select: { contextoOperacional: true, tipoNegocio: true, idioma: true },
    })
    if (!config?.contextoOperacional) {
      return reply.code(422).send({ error: 'Nenhum contexto para melhorar' })
    }
    const idioma = config.idioma ?? 'pt-BR'
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: `You are an expert in configuring AI assistants for businesses. Rewrite the operational context in a clear, professional and detailed way, to be used as an instruction for an AI assistant via WhatsApp. Business type: ${config.tipoNegocio ?? 'not informed'}. IMPORTANT: respond ONLY in the language "${idioma}". Return ONLY the rewritten text, without titles, labels, prefixes or explanations. Do NOT mention communication tone, style or way of speaking — that is configured separately.` },
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

  // PATCH /app/config/coleta-dados
  app.patch('/coleta-dados', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      coletarCadastroCompleto: z.boolean().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', ...body.data },
      update: body.data,
      select: { coletarCadastroCompleto: true },
    })
  })

  // POST /app/config/gerar-prompt — IA gera prompt com base no tipo de negócio
  app.post('/gerar-prompt', { preHandler }, async (request: any, reply) => {
    const body = gerarPromptBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { tipoNegocio, nomeEmpresa, descricao } = body.data

    const configDb = await prisma.configBot.findUnique({
      where: { empresaId: request.empresaId },
      select: { idioma: true },
    })
    const idioma = configDb?.idioma ?? 'pt-BR'

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert in creating prompts for WhatsApp AI assistants focused on scheduling.
Create a complete, professional system prompt for a virtual assistant.
The prompt must include: persona, objective, scheduling rules, service flows and escalation instructions to humans.
Do NOT include communication tone, language style or way of speaking — that is configured separately and will be injected automatically.
IMPORTANT: write the entire prompt in the language "${idioma}".
Return ONLY the prompt, without any additional explanations.`,
        },
        {
          role: 'user',
          content: `Business type: ${tipoNegocio}\nBusiness name: ${nomeEmpresa}${descricao ? `\nAdditional description: ${descricao}` : ''}`,
        },
      ],
    })

    const prompt = completion.choices[0]?.message?.content ?? ''
    return { prompt }
  })
}
