import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireAdminGlobal } from '../../lib/auth.js'

const moduleBody = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  chave: z.string().min(1).regex(/^[a-z0-9-_]+$/, 'Apenas letras minúsculas, números, hífen e underscore'),
  icon: z.string().default('🧩'),
  highlightBadge: z.string().default(''),
  routePath: z.string().default(''),
  displayOrder: z.number().int().default(0),
  status: z.enum(['active', 'coming_soon', 'disabled']).default('active'),
  requiresPlan: z.boolean().default(false),
  stripePriceId: z.string().optional(),
  ativo: z.boolean().default(true),
})

export async function modulesRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireAdminGlobal]

  // GET /admin/modules
  app.get('/', { preHandler }, async () => {
    return prisma.internalModule.findMany({ orderBy: { displayOrder: 'asc' } })
  })

  // POST /admin/modules
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = moduleBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const exists = await prisma.internalModule.findUnique({ where: { chave: body.data.chave } })
    if (exists) return reply.code(409).send({ error: `Módulo com chave '${body.data.chave}' já existe` })

    return reply.code(201).send(
      await prisma.internalModule.create({ data: body.data })
    )
  })

  // PATCH /admin/modules/:id
  app.patch('/:id', { preHandler }, async (request: any, reply) => {
    const body = moduleBody.partial().omit({ chave: true }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const exists = await prisma.internalModule.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Módulo não encontrado' })

    return prisma.internalModule.update({ where: { id: request.params.id }, data: body.data })
  })

  // PATCH /admin/modules/:id/toggle
  app.patch('/:id/toggle', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.internalModule.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Módulo não encontrado' })

    return prisma.internalModule.update({
      where: { id: request.params.id },
      data: { ativo: !exists.ativo },
      select: { id: true, chave: true, ativo: true },
    })
  })

  // DELETE /admin/modules/:id
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.internalModule.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Módulo não encontrado' })

    await prisma.internalModule.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })
}

export async function modulesPublicRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return prisma.internalModule.findMany({
      where: { ativo: true },
      orderBy: { displayOrder: 'asc' },
    })
  })
}
