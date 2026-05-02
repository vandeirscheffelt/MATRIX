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

const feriadoBody = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nome: z.string().min(1),
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

  // GET /app/bloqueios/feriados — lista feriados/dias bloqueados da empresa
  app.get('/feriados', { preHandler }, async (request: any) => {
    const profissionais = await prisma.profissional.findMany({
      where: { empresaId: request.empresaId, ativo: true },
      select: { id: true },
    })
    if (profissionais.length === 0) return []

    // Feriados = bloqueios de dia inteiro que cobrem TODOS os profissionais ativos na mesma data
    // Identificamos pelo motivo compartilhado e dataInicio meia-noite
    const bloqueios = await prisma.bloqueio.findMany({
      where: {
        profissionalId: { in: profissionais.map(p => p.id) },
        motivo: { startsWith: '[FERIADO]' },
      },
      orderBy: { dataInicio: 'asc' },
    })

    // Deduplica por data+motivo (retorna um registro representativo por feriado)
    const seen = new Map<string, typeof bloqueios[0]>()
    bloqueios.forEach(b => {
      const key = `${b.dataInicio.toISOString().slice(0, 10)}__${b.motivo}`
      if (!seen.has(key)) seen.set(key, b)
    })
    return Array.from(seen.values()).map(b => ({
      id: b.id,
      data: b.dataInicio.toISOString().slice(0, 10),
      nome: b.motivo?.replace('[FERIADO] ', '') ?? '',
    }))
  })

  // POST /app/bloqueios/feriados — cria bloqueio para TODOS os profissionais no dia
  app.post('/feriados', { preHandler }, async (request: any, reply) => {
    const body = feriadoBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const profissionais = await prisma.profissional.findMany({
      where: { empresaId: request.empresaId, ativo: true },
      select: { id: true },
    })
    if (profissionais.length === 0) return reply.code(400).send({ error: 'Nenhum profissional ativo' })

    const dataInicio = new Date(`${body.data.data}T00:00:00Z`)
    const dataFim = new Date(`${body.data.data}T23:59:59Z`)
    const motivo = `[FERIADO] ${body.data.nome}`

    await prisma.bloqueio.createMany({
      data: profissionais.map(p => ({
        profissionalId: p.id,
        dataInicio,
        dataFim,
        motivo,
      })),
    })

    return { ok: true, data: body.data.data, nome: body.data.nome, total: profissionais.length }
  })

  // DELETE /app/bloqueios/feriados/:data — remove feriado de todos os profissionais
  app.delete('/feriados/:data', { preHandler }, async (request: any, reply) => {
    const { data } = request.params as { data: string }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return reply.code(400).send({ error: 'Formato inválido' })

    const profissionais = await prisma.profissional.findMany({
      where: { empresaId: request.empresaId, ativo: true },
      select: { id: true },
    })

    const dataInicio = new Date(`${data}T00:00:00Z`)
    const dataFim = new Date(`${data}T23:59:59Z`)

    await prisma.bloqueio.deleteMany({
      where: {
        profissionalId: { in: profissionais.map(p => p.id) },
        dataInicio: { gte: dataInicio, lte: dataFim },
        motivo: { startsWith: '[FERIADO]' },
      },
    })
    return { ok: true }
  })
}
