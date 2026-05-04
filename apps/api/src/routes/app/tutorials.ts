import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth } from '../../lib/auth.js'
import { requireAdminGlobal } from '../../lib/auth.js'

const tutorialBody = z.object({
  titulo: z.string().min(1),
  descricao: z.string().optional(),
  videoUrl: z.string().min(1).transform(url => url.startsWith('http') ? url : `https://${url}`),
  categoria: z.enum(['primeiros_passos', 'configuracao', 'whatsapp', 'agenda', 'relatorios']).default('primeiros_passos'),
  ordem: z.number().int().default(0),
  obrigatorio: z.boolean().default(false),
  ativo: z.boolean().default(true),
})

export async function tutorialsPublicRoutes(app: FastifyInstance) {
  // GET /tutorials/public — lista tutoriais ativos (sem auth)
  app.get('/', async () => {
    return prisma.tutorial.findMany({
      where: { ativo: true },
      orderBy: [{ categoria: 'asc' }, { ordem: 'asc' }],
    })
  })
}

export async function tutorialsAdminRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireAdminGlobal]

  // GET /admin/tutorials
  app.get('/', { preHandler }, async () => {
    return prisma.tutorial.findMany({
      orderBy: [{ categoria: 'asc' }, { ordem: 'asc' }],
    })
  })

  // POST /admin/tutorials
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = tutorialBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return reply.code(201).send(await prisma.tutorial.create({ data: body.data }))
  })

  // PATCH /admin/tutorials/:id
  app.patch('/:id', { preHandler }, async (request: any, reply) => {
    const body = tutorialBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const exists = await prisma.tutorial.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Tutorial não encontrado' })
    return prisma.tutorial.update({ where: { id: request.params.id }, data: body.data })
  })

  // DELETE /admin/tutorials/:id
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.tutorial.findUnique({ where: { id: request.params.id } })
    if (!exists) return reply.code(404).send({ error: 'Tutorial não encontrado' })
    await prisma.tutorial.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })
}
