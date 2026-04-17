import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireAdminGlobal } from '../../lib/auth.js'

const pricingBody = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  payload: z.record(z.unknown()).default({}),
})

export async function pricingRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireAdminGlobal]

  // GET /admin/pricing-versions
  app.get('/', { preHandler }, async () => {
    return prisma.pricingVersion.findMany({ orderBy: { criadoEm: 'desc' } })
  })

  // POST /admin/pricing-versions
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = pricingBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    return reply.code(201).send(
      await prisma.pricingVersion.create({ data: body.data })
    )
  })

  // PATCH /admin/pricing-versions/:id
  app.patch('/:id', { preHandler }, async (request: any, reply) => {
    const body = pricingBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const exists = await prisma.pricingVersion.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Versão não encontrada' })

    return prisma.pricingVersion.update({ where: { id: request.params.id }, data: body.data })
  })

  // POST /admin/pricing-versions/:id/apply — ativa esta versão, desativa as demais
  app.post('/:id/apply', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.pricingVersion.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Versão não encontrada' })

    await prisma.$transaction([
      prisma.pricingVersion.updateMany({ where: {}, data: { ativa: false } }),
      prisma.pricingVersion.update({
        where: { id: request.params.id },
        data: { ativa: true, ativadoEm: new Date() },
      }),
    ])

    return { ok: true, ativa: request.params.id }
  })
}
