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
