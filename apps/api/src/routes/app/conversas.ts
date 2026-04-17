import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const replyBody = z.object({
  conteudo: z.string().min(1),
})

const listQuery = z.object({
  status: z.enum(['ativa', 'arquivada', 'all']).default('ativa'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export async function conversasRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/conversas?status=ativa|arquivada|all
  app.get('/', { preHandler }, async (request: any) => {
    const query = listQuery.parse(request.query)
    const skip = (query.page - 1) * query.limit

    const where: any = { empresaId: request.empresaId }
    if (query.status === 'ativa')    where.arquivada = false
    if (query.status === 'arquivada') where.arquivada = true

    const [total, items] = await Promise.all([
      prisma.conversa.count({ where }),
      prisma.conversa.findMany({
        where,
        include: {
          lead: { select: { nomeWpp: true, telefone: true } },
        },
        orderBy: { ultimaAtividade: { sort: 'desc', nulls: 'last' } },
        skip,
        take: query.limit,
      }),
    ])

    return { total, page: query.page, limit: query.limit, items }
  })

  // GET /app/conversas/:id
  app.get('/:id', { preHandler }, async (request: any, reply) => {
    const conversa = await prisma.conversa.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
      include: {
        lead: { select: { nomeWpp: true, telefone: true } },
        mensagens: { orderBy: { criadoEm: 'asc' } },
      },
    })
    if (!conversa) return reply.code(404).send({ error: 'Conversa não encontrada' })
    return conversa
  })

  // POST /app/conversas/:id/reply — resposta humana manual
  app.post('/:id/reply', { preHandler }, async (request: any, reply) => {
    const body = replyBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const conversa = await prisma.conversa.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!conversa) return reply.code(404).send({ error: 'Conversa não encontrada' })

    const mensagem = await prisma.mensagemConversa.create({
      data: {
        conversaId: conversa.id,
        origem: 'HUMANO',
        conteudo: body.data.conteudo,
      },
    })

    await prisma.conversa.update({
      where: { id: conversa.id },
      data: { ultimaMensagem: body.data.conteudo, ultimaAtividade: new Date() },
    })

    return reply.code(201).send(mensagem)
  })

  // POST /app/conversas/:id/pause — assume conversa, pausa IA
  app.post('/:id/pause', { preHandler }, async (request: any, reply) => {
    const conversa = await prisma.conversa.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!conversa) return reply.code(404).send({ error: 'Conversa não encontrada' })
    if (conversa.statusIa === 'PAUSADO') return reply.code(409).send({ error: 'IA já está pausada' })

    return prisma.conversa.update({
      where: { id: conversa.id },
      data: { statusIa: 'PAUSADO', pausadoEm: new Date() },
    })
  })

  // POST /app/conversas/:id/resume — devolve controle para IA
  app.post('/:id/resume', { preHandler }, async (request: any, reply) => {
    const conversa = await prisma.conversa.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!conversa) return reply.code(404).send({ error: 'Conversa não encontrada' })
    if (conversa.statusIa === 'ATIVO') return reply.code(409).send({ error: 'IA já está ativa' })

    return prisma.conversa.update({
      where: { id: conversa.id },
      data: { statusIa: 'ATIVO', pausadoEm: null, retornoEm: null },
    })
  })

  // POST /app/conversas/:id/archive
  app.post('/:id/archive', { preHandler }, async (request: any, reply) => {
    const conversa = await prisma.conversa.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!conversa) return reply.code(404).send({ error: 'Conversa não encontrada' })
    if (conversa.arquivada) return reply.code(409).send({ error: 'Conversa já arquivada' })

    return prisma.conversa.update({
      where: { id: conversa.id },
      data: { arquivada: true },
    })
  })

  // POST /app/conversas/:id/resolve
  app.post('/:id/resolve', { preHandler }, async (request: any, reply) => {
    const conversa = await prisma.conversa.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!conversa) return reply.code(404).send({ error: 'Conversa não encontrada' })
    if (conversa.resolvidaEm) return reply.code(409).send({ error: 'Conversa já resolvida' })

    return prisma.conversa.update({
      where: { id: conversa.id },
      data: { resolvidaEm: new Date(), arquivada: true },
    })
  })
}
