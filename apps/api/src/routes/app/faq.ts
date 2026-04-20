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
