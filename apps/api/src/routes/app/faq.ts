import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const faqBody = z.object({
  pergunta: z.string().min(1),
  resposta: z.string().min(1),
})

export async function faqRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/faq
  app.get('/', { preHandler }, async (request: any) => {
    return prisma.faqEntry.findMany({
      where: { empresaId: request.empresaId },
      orderBy: { criadoEm: 'asc' },
    })
  })

  // POST /app/faq
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = faqBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    return reply.code(201).send(
      await prisma.faqEntry.create({
        data: { empresaId: request.empresaId, ...body.data },
      })
    )
  })

  // PATCH /app/faq/:id
  app.patch('/:id', { preHandler }, async (request: any, reply) => {
    const body = faqBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const exists = await prisma.faqEntry.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!exists) return reply.code(404).send({ error: 'FAQ não encontrado' })

    return prisma.faqEntry.update({ where: { id: request.params.id }, data: body.data })
  })

  // DELETE /app/faq/:id
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.faqEntry.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!exists) return reply.code(404).send({ error: 'FAQ não encontrado' })

    await prisma.faqEntry.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })

  // PUT /app/faq — replace all FAQs for this empresa
  app.put('/', { preHandler }, async (request: any, reply) => {
    const body = z.array(faqBody).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    await prisma.$transaction([
      prisma.faqEntry.deleteMany({ where: { empresaId: request.empresaId } }),
      ...body.data.map(faq =>
        prisma.faqEntry.create({ data: { empresaId: request.empresaId, ...faq } })
      ),
    ])
    return reply.code(204).send()
  })

  // POST /app/faq/melhorar — IA melhora FAQ ou pede esclarecimento se contexto insuficiente
  app.post('/melhorar', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      pergunta: z.string().min(1),
      resposta: z.string().min(1),
      contexto_adicional: z.string().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const config = await prisma.configBot.findUnique({
      where: { empresaId: request.empresaId },
      select: { tipoNegocio: true, contextoOperacional: true, idioma: true },
    })
    const idioma = config?.idioma ?? 'pt-BR'

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const userContent = body.data.contexto_adicional
      ? `Pergunta: ${body.data.pergunta}\nResposta: ${body.data.resposta}\nContexto adicional fornecido pelo usuário: ${body.data.contexto_adicional}`
      : `Pergunta: ${body.data.pergunta}\nResposta: ${body.data.resposta}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `You improve FAQ questions and answers for a WhatsApp AI assistant.
IMPORTANT: respond entirely in the language "${idioma}".

COMPANY CONTEXT (read carefully before any decision):
- Business type: ${config?.tipoNegocio ?? 'not informed'}
- Operational context: ${config?.contextoOperacional ?? 'not informed'}

MANDATORY RULES:
- The customer IS ALREADY in a WhatsApp conversation — NEVER suggest "contact us" or "get in touch"
- NEVER invent information not present in the company context, question/answer or additional context
- Before asking for clarification, check if the answer is already in the operational context above

DECISION ORDER:
1. If the operational context already answers the question → generate the suggestion using that information
2. If additional context was provided by the user → use it to generate the suggestion
3. Only if there is insufficient information in any source → ask for clarification with ONE specific question

WHEN ASKING FOR CLARIFICATION:
- Return: {"needs_clarification": true, "question": "your question here"}

WHEN GENERATING SUGGESTION:
- Return: {"needs_clarification": false, "pergunta": "...", "resposta": "..."}`,
        },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0]?.message?.content ?? '{}')

    if (result.needs_clarification) {
      return { needs_clarification: true, question: result.question ?? 'Pode fornecer mais detalhes sobre esta resposta?' }
    }

    return {
      needs_clarification: false,
      pergunta: result.pergunta ?? body.data.pergunta,
      resposta: result.resposta ?? body.data.resposta,
    }
  })

  // GET /app/faq/sugestoes
  app.get('/sugestoes', { preHandler }, async (request: any) => {
    return prisma.faqSugestao.findMany({
      where: { empresaId: request.empresaId, status: 'pendente' },
      orderBy: { criadoEm: 'desc' },
    })
  })

  // POST /app/faq/sugestoes/:id/aprovar — vira FAQ entry
  app.post('/sugestoes/:id/aprovar', { preHandler }, async (request: any, reply) => {
    const sugestao = await prisma.faqSugestao.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId, status: 'pendente' },
    })
    if (!sugestao) return reply.code(404).send({ error: 'Sugestão não encontrada' })

    const [entry] = await prisma.$transaction([
      prisma.faqEntry.create({
        data: {
          empresaId: request.empresaId,
          pergunta: sugestao.pergunta,
          resposta: sugestao.respostaSugerida,
          origem: 'sugestao_ia',
        },
      }),
      prisma.faqSugestao.update({
        where: { id: sugestao.id },
        data: { status: 'aprovada' },
      }),
    ])

    return reply.code(201).send(entry)
  })

  // POST /app/faq/sugestoes/:id/rejeitar
  app.post('/sugestoes/:id/rejeitar', { preHandler }, async (request: any, reply) => {
    const sugestao = await prisma.faqSugestao.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId, status: 'pendente' },
    })
    if (!sugestao) return reply.code(404).send({ error: 'Sugestão não encontrada' })

    return prisma.faqSugestao.update({
      where: { id: sugestao.id },
      data: { status: 'rejeitada' },
    })
  })
}
