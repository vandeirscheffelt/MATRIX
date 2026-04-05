import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database/client'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const gerenteBody = z.object({
  telefone: z.string().min(10),
  resumoAtivo: z.boolean().optional(),
  resumoIntervalo: z.enum(['DIARIO', 'SEMANAL']).nullable().optional(),
  resumoHorario: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
})

export async function gerenteRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/gerente
  app.get('/', { preHandler }, async (request: any) => {
    return prisma.numeroGerente.findMany({ where: { empresaId: request.empresaId } })
  })

  // POST /app/gerente
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = gerenteBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const gerente = await prisma.numeroGerente.create({
      data: { empresaId: request.empresaId, ...body.data },
    })
    return gerente
  })

  // DELETE /app/gerente/:id
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    const gerente = await prisma.numeroGerente.findFirst({
      where: { id, empresaId: request.empresaId },
    })
    if (!gerente) return reply.code(404).send({ error: 'Número não encontrado' })

    await prisma.numeroGerente.delete({ where: { id } })
    return { success: true }
  })
}
