import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireAdminGlobal, requireActiveSubscription } from '../../lib/auth.js'

const afiliadoBody = z.object({
  productName: z.string().min(1),
  shortDescription: z.string().default(''),
  status: z.enum(['active', 'coming_soon']).default('active'),
  externalLink: z.string().min(1).transform(url => url.startsWith('http') ? url : `https://${url}`),
  icon: z.string().default('🤝'),
  highlightBadge: z.string().default(''),
  displayOrder: z.number().int().default(0),
})

export async function afiliadosRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/afiliados
  app.get('/', { preHandler: [requireAuth] }, async (request: any) => {
    return prisma.produtoAfiliado.findMany({
      orderBy: { displayOrder: 'asc' },
    })
  })

  // POST /app/afiliados
  app.post('/', { preHandler: [requireAuth, requireAdminGlobal] }, async (request: any, reply) => {
    const body = afiliadoBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return reply.code(201).send(
      await prisma.produtoAfiliado.create({ data: body.data })
    )
  })

  // PUT /app/afiliados/:id
  app.put('/:id', { preHandler: [requireAuth, requireAdminGlobal] }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const body = afiliadoBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const exists = await prisma.produtoAfiliado.findUnique({ where: { id } })
    if (!exists) return reply.code(404).send({ error: 'Produto não encontrado' })
    return prisma.produtoAfiliado.update({ where: { id }, data: body.data })
  })

  // DELETE /app/afiliados/:id
  app.delete('/:id', { preHandler: [requireAuth, requireAdminGlobal] }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const exists = await prisma.produtoAfiliado.findUnique({ where: { id } })
    if (!exists) return reply.code(404).send({ error: 'Produto não encontrado' })
    await prisma.produtoAfiliado.delete({ where: { id } })
    return { ok: true }
  })
}
