import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireAdminGlobal } from '../../lib/auth.js'

const productBody = z.object({
  product_name:      z.string().min(1),
  short_description: z.string().max(300).default(''),
  status:            z.enum(['active', 'coming_soon']).default('active'),
  external_link:     z.string().default(''),
  icon:              z.string().default('📦'),
  highlight_badge:   z.string().default(''),
  display_order:     z.number().int().default(0),
  category:          z.string().default('apps'),
  display_mode:      z.enum(['icon', 'catalog']).default('icon'),
  images:            z.array(z.string()).default([]),
})

function toApi(p: any) {
  return {
    id:               p.id,
    product_name:     p.productName,
    short_description:p.shortDescription,
    status:           p.status,
    external_link:    p.externalLink,
    icon:             p.icon,
    highlight_badge:  p.highlightBadge,
    display_order:    p.displayOrder,
    category:         p.category,
    display_mode:     p.displayMode,
    images:           p.images,
  }
}

export async function productsPublicRoutes(app: FastifyInstance) {
  // GET /products/public — lista produtos ativos (sem auth)
  app.get('/', async () => {
    const rows = await prisma.product.findMany({
      where: { status: { in: ['active', 'coming_soon'] } },
      orderBy: { displayOrder: 'asc' },
    })
    return rows.map(toApi)
  })
}

export async function productsAdminRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireAdminGlobal]

  // GET /admin/products
  app.get('/', { preHandler }, async () => {
    return (await prisma.product.findMany({ orderBy: { displayOrder: 'asc' } })).map(toApi)
  })

  // POST /admin/products
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = productBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const { product_name, short_description, external_link, highlight_badge, display_order, display_mode, ...rest } = body.data
    const row = await prisma.product.create({
      data: {
        productName:      product_name,
        shortDescription: short_description,
        externalLink:     external_link,
        highlightBadge:   highlight_badge,
        displayOrder:     display_order,
        displayMode:      display_mode,
        ...rest,
      },
    })
    return reply.code(201).send(toApi(row))
  })

  // PATCH /admin/products/:id
  app.patch('/:id', { preHandler }, async (request: any, reply) => {
    const body = productBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const exists = await prisma.product.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Produto não encontrado' })
    const { product_name, short_description, external_link, highlight_badge, display_order, display_mode, ...rest } = body.data
    const row = await prisma.product.update({
      where: { id: request.params.id },
      data: {
        ...(product_name      !== undefined && { productName:      product_name }),
        ...(short_description !== undefined && { shortDescription: short_description }),
        ...(external_link     !== undefined && { externalLink:     external_link }),
        ...(highlight_badge   !== undefined && { highlightBadge:   highlight_badge }),
        ...(display_order     !== undefined && { displayOrder:     display_order }),
        ...(display_mode      !== undefined && { displayMode:      display_mode }),
        ...rest,
      },
    })
    return toApi(row)
  })

  // DELETE /admin/products/:id
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.product.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Produto não encontrado' })
    await prisma.product.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })
}
