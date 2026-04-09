import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const profissionalBody = z.object({
  nome: z.string().min(1),
  duracaoPadraoMin: z.number().int().positive().default(60),
})

const gradeBody = z.array(z.object({
  diaSemana: z.number().int().min(0).max(6),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/),
  horaFim: z.string().regex(/^\d{2}:\d{2}$/),
}))

const bloqueioBody = z.object({
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime(),
  motivo: z.string().optional(),
})

export async function profissionaisRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/profissionais
  app.get('/', { preHandler }, async (request: any) => {
    return prisma.profissional.findMany({
      where: { empresaId: request.empresaId, ativo: true },
    })
  })

  // POST /app/profissionais
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = profissionalBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    return prisma.profissional.create({
      data: { empresaId: request.empresaId, ...body.data },
    })
  })

  // PUT /app/profissionais/:id
  app.put('/:id', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const body = profissionalBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const existing = await prisma.profissional.findFirst({
      where: { id, empresaId: request.empresaId },
    })
    if (!existing) return reply.code(404).send({ error: 'Profissional não encontrado' })

    return prisma.profissional.update({ where: { id }, data: body.data })
  })

  // DELETE /app/profissionais/:id — desativa (soft delete)
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.profissional.findFirst({
      where: { id, empresaId: request.empresaId },
    })
    if (!existing) return reply.code(404).send({ error: 'Profissional não encontrado' })

    return prisma.profissional.update({ where: { id }, data: { ativo: false } })
  })

  // GET /app/profissionais/:id/grade
  app.get('/:id/grade', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.profissional.findFirst({
      where: { id, empresaId: request.empresaId },
    })
    if (!existing) return reply.code(404).send({ error: 'Profissional não encontrado' })

    return prisma.gradeHorario.findMany({ where: { profissionalId: id } })
  })

  // PUT /app/profissionais/:id/grade — substitui grade completa
  app.put('/:id/grade', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const body = gradeBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const existing = await prisma.profissional.findFirst({
      where: { id, empresaId: request.empresaId },
    })
    if (!existing) return reply.code(404).send({ error: 'Profissional não encontrado' })

    await prisma.gradeHorario.deleteMany({ where: { profissionalId: id } })
    await prisma.gradeHorario.createMany({
      data: body.data.map(g => ({ profissionalId: id, ...g })),
    })

    return prisma.gradeHorario.findMany({ where: { profissionalId: id } })
  })

  // GET /app/profissionais/:id/bloqueios
  app.get('/:id/bloqueios', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.profissional.findFirst({
      where: { id, empresaId: request.empresaId },
    })
    if (!existing) return reply.code(404).send({ error: 'Profissional não encontrado' })

    return prisma.bloqueio.findMany({ where: { profissionalId: id } })
  })

  // POST /app/profissionais/:id/bloqueios
  app.post('/:id/bloqueios', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const body = bloqueioBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const existing = await prisma.profissional.findFirst({
      where: { id, empresaId: request.empresaId },
    })
    if (!existing) return reply.code(404).send({ error: 'Profissional não encontrado' })

    return prisma.bloqueio.create({
      data: {
        profissionalId: id,
        dataInicio: new Date(body.data.dataInicio),
        dataFim: new Date(body.data.dataFim),
        motivo: body.data.motivo,
      },
    })
  })

  // DELETE /app/profissionais/:id/bloqueios/:bid
  app.delete('/:id/bloqueios/:bid', { preHandler }, async (request: any, reply) => {
    const { id, bid } = request.params as { id: string; bid: string }

    const bloqueio = await prisma.bloqueio.findFirst({
      where: { id: bid, profissionalId: id },
    })
    if (!bloqueio) return reply.code(404).send({ error: 'Bloqueio não encontrado' })

    await prisma.bloqueio.delete({ where: { id: bid } })
    return { success: true }
  })
}
