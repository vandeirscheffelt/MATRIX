import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const bloqueioBody = z.object({
  profissionalId: z.string().uuid(),
  dataInicio: z.string().datetime(),
  dataFim: z.string().datetime(),
  motivo: z.string().optional(),
})

export async function bloqueiosRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // POST /app/bloqueios
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = bloqueioBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const profissional = await prisma.profissional.findFirst({
      where: { id: body.data.profissionalId, empresaId: request.empresaId, ativo: true },
    })
    if (!profissional) return reply.code(404).send({ error: 'Profissional não encontrado' })

    return prisma.bloqueio.create({
      data: {
        profissionalId: body.data.profissionalId,
        dataInicio: new Date(body.data.dataInicio),
        dataFim: new Date(body.data.dataFim),
        motivo: body.data.motivo,
      },
    })
  })

  // DELETE /app/bloqueios/:id
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    const bloqueio = await prisma.bloqueio.findFirst({
      where: { id },
      include: { profissional: { select: { empresaId: true } } },
    })
    if (!bloqueio || bloqueio.profissional.empresaId !== request.empresaId) {
      return reply.code(404).send({ error: 'Bloqueio não encontrado' })
    }

    await prisma.bloqueio.delete({ where: { id } })
    return { ok: true }
  })
}
