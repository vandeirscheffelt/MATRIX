import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const keywordBody = z.object({
  palavra: z.string().min(1),
})

export async function keywordsRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/config/keywords
  app.get('/', { preHandler }, async (request: any) => {
    return prisma.keyword.findMany({
      where: { empresaId: request.empresaId },
      orderBy: { criadoEm: 'asc' },
    })
  })

  // POST /app/config/keywords
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = keywordBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const exists = await prisma.keyword.findUnique({
      where: { empresaId_palavra: { empresaId: request.empresaId, palavra: body.data.palavra } },
    })
    if (exists) return reply.code(409).send({ error: 'Keyword já cadastrada' })

    return reply.code(201).send(
      await prisma.keyword.create({
        data: { empresaId: request.empresaId, palavra: body.data.palavra },
      })
    )
  })

  // DELETE /app/config/keywords/:id
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.keyword.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!exists) return reply.code(404).send({ error: 'Keyword não encontrada' })

    await prisma.keyword.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })

  // POST /app/config/keywords/sugerir — IA sugere com base no contexto do negócio
  app.post('/sugerir', { preHandler }, async (request: any, reply) => {
    const config = await prisma.configBot.findUnique({
      where: { empresaId: request.empresaId },
      select: { tipoNegocio: true, contextoOperacional: true, prompt: true },
    })

    if (!config?.tipoNegocio && !config?.contextoOperacional) {
      return reply.code(422).send({ error: 'Configure o tipo de negócio ou contexto operacional antes de sugerir keywords' })
    }

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é especialista em marketing e SEO para pequenos negócios brasileiros. Retorne APENAS um array JSON de strings com as palavras-chave sugeridas, sem explicações.',
        },
        {
          role: 'user',
          content: `Sugira até 10 palavras-chave relevantes para este negócio:
Tipo: ${config.tipoNegocio ?? 'não informado'}
Contexto: ${config.contextoOperacional ?? 'não informado'}`,
        },
      ],
    })

    try {
      const sugestoes = JSON.parse(completion.choices[0]?.message?.content ?? '[]') as string[]
      return { sugestoes }
    } catch {
      return { sugestoes: [] }
    }
  })
}
