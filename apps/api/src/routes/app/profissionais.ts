import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const profissionalBody = z.object({
  nome: z.string().min(1),
  telefone: z.string().optional(),
  cor: z.string().optional(),
  aiAccess: z.boolean().optional(),
  duracaoPadraoMin: z.number().int().positive().default(60),
  intervaloInicio: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  intervaloFim: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
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

const ausenciaBody = z.object({
  dataInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  dataFim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  motivo: z.string().optional(),
})

export async function profissionaisRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/profissionais
  app.get('/', { preHandler }, async (request: any) => {
    return prisma.profissional.findMany({
      where: { empresaId: request.empresaId, ativo: true },
      include: { gradeHorarios: true, profissionalServicos: true },
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

  // PUT /app/profissionais/:id/servicos — substitui lista de serviços vinculados
  app.put('/:id/servicos', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const body = z.object({ servicoIds: z.array(z.string().uuid()) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const existing = await prisma.profissional.findFirst({ where: { id, empresaId: request.empresaId } })
    if (!existing) return reply.code(404).send({ error: 'Profissional não encontrado' })

    await prisma.profissionalServico.deleteMany({ where: { profissionalId: id } })
    if (body.data.servicoIds.length > 0) {
      await prisma.profissionalServico.createMany({
        data: body.data.servicoIds.map(servicoId => ({ profissionalId: id, servicoId })),
        skipDuplicates: true,
      })
    }
    return { profissionalId: id, servicoIds: body.data.servicoIds }
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

  // GET /app/profissionais/:id/ausencias — bloqueios de dia inteiro (duração >= 12h)
  app.get('/:id/ausencias', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.profissional.findFirst({ where: { id, empresaId: request.empresaId } })
    if (!existing) return reply.code(404).send({ error: 'Profissional não encontrado' })

    const bloqueios = await prisma.bloqueio.findMany({
      where: { profissionalId: id },
      orderBy: { dataInicio: 'asc' },
    })
    // Ausências = bloqueios com duração >= 12 horas
    return bloqueios.filter((b: { dataInicio: Date; dataFim: Date }) => {
      const diff = new Date(b.dataFim).getTime() - new Date(b.dataInicio).getTime()
      return diff >= 12 * 60 * 60 * 1000
    })
  })

  // POST /app/profissionais/:id/ausencias — cria bloqueio cobrindo range de datas completo
  app.post('/:id/ausencias', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const body = ausenciaBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const existing = await prisma.profissional.findFirst({ where: { id, empresaId: request.empresaId } })
    if (!existing) return reply.code(404).send({ error: 'Profissional não encontrado' })

    return prisma.bloqueio.create({
      data: {
        profissionalId: id,
        dataInicio: new Date(`${body.data.dataInicio}T00:00:00Z`),
        dataFim: new Date(`${body.data.dataFim}T23:59:59Z`),
        motivo: body.data.motivo,
      },
    })
  })

  // DELETE /app/profissionais/:id/ausencias/:aid
  app.delete('/:id/ausencias/:aid', { preHandler }, async (request: any, reply) => {
    const { id, aid } = request.params as { id: string; aid: string }
    const bloqueio = await prisma.bloqueio.findFirst({ where: { id: aid, profissionalId: id } })
    if (!bloqueio) return reply.code(404).send({ error: 'Ausência não encontrada' })
    await prisma.bloqueio.delete({ where: { id: aid } })
    return { success: true }
  })
}
