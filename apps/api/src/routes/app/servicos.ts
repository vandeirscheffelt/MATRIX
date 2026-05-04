import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const servicoBody = z.object({
  nome: z.string().min(1),
  duracaoMin: z.number().int().positive().default(60),
  ordem: z.number().int().min(0).default(0),
  color: z.string().default(""),
})

const servicoUpdateBody = servicoBody.partial()

const reorderBody = z.object({
  ids: z.array(z.string().uuid()),
})

export async function servicosRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/servicos
  app.get('/', { preHandler }, async (request: any) => {
    return prisma.servico.findMany({
      where: { empresaId: request.empresaId, ativo: true },
      orderBy: { ordem: 'asc' },
    })
  })

  // POST /app/servicos
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = servicoBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const ultimo = await prisma.servico.findFirst({
      where: { empresaId: request.empresaId },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    })

    return reply.code(201).send(
      await prisma.servico.create({
        data: {
          empresaId: request.empresaId,
          nome: body.data.nome,
          duracaoMin: body.data.duracaoMin,
          ordem: ultimo ? ultimo.ordem + 1 : 0,
        },
      })
    )
  })

  // PATCH /app/servicos/:id
  app.patch('/:id', { preHandler }, async (request: any, reply) => {
    const body = servicoUpdateBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const exists = await prisma.servico.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!exists) return reply.code(404).send({ error: 'Serviço não encontrado' })

    return prisma.servico.update({
      where: { id: request.params.id },
      data: body.data,
    })
  })

  // DELETE /app/servicos/:id — soft delete
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.servico.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!exists) return reply.code(404).send({ error: 'Serviço não encontrado' })

    await prisma.servico.update({
      where: { id: request.params.id },
      data: { ativo: false },
    })
    return reply.code(204).send()
  })

  // PATCH /app/servicos/reorder — reordena por array de ids
  app.patch('/reorder', { preHandler }, async (request: any, reply) => {
    const body = reorderBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    await prisma.$transaction(
      body.data.ids.map((id, index) =>
        prisma.servico.updateMany({
          where: { id, empresaId: request.empresaId },
          data: { ordem: index },
        })
      )
    )
    return { ok: true }
  })
}
