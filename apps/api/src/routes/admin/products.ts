import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireAdminGlobal } from '../../lib/auth.js'

const productBody = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  url: z.string().url().optional(),
  ordem: z.number().int().min(0).default(0),
})

export async function productsRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireAdminGlobal]

  // GET /admin/products
  app.get('/', { preHandler }, async () => {
    return prisma.externalProduct.findMany({ orderBy: { ordem: 'asc' } })
  })

  // POST /admin/products
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = productBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    return reply.code(201).send(
      await prisma.externalProduct.create({ data: body.data })
    )
  })

  // PATCH /admin/products/:id
  app.patch('/:id', { preHandler }, async (request: any, reply) => {
    const body = productBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const exists = await prisma.externalProduct.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Produto não encontrado' })

    return prisma.externalProduct.update({ where: { id: request.params.id }, data: body.data })
  })

  // PATCH /admin/products/:id/toggle
  app.patch('/:id/toggle', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.externalProduct.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Produto não encontrado' })

    return prisma.externalProduct.update({
      where: { id: request.params.id },
      data: { ativo: !exists.ativo },
      select: { id: true, ativo: true },
    })
  })

  // DELETE /admin/products/:id
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.externalProduct.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Produto não encontrado' })

    await prisma.externalProduct.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })

  // GET /products/public — versão pública para tenants (sem auth de admin)
  // Registrado separadamente no index.ts
}

export async function productsPublicRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return prisma.externalProduct.findMany({
      where: { ativo: true },
      orderBy: { ordem: 'asc' },
      select: { id: true, nome: true, descricao: true, url: true },
    })
  })
}
