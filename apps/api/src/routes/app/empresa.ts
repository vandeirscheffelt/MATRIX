import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database/client'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const updateEmpresaBody = z.object({
  nome: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
})

export async function empresaRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/empresa
  app.get('/', { preHandler }, async (request: any, reply) => {
    const empresa = await prisma.empresa.findUnique({
      where: { id: request.empresaId },
      select: { id: true, nome: true, slug: true, criadoEm: true },
    })
    if (!empresa) return reply.code(404).send({ error: 'Empresa não encontrada' })
    return empresa
  })

  // PUT /app/empresa
  app.put('/', { preHandler }, async (request: any, reply) => {
    const body = updateEmpresaBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const empresa = await prisma.empresa.update({
      where: { id: request.empresaId },
      data: body.data,
    })
    return empresa
  })
}
