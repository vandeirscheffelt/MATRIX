import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const agendamentoBody = z.object({
  profissionalId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  clienteNome: z.string().optional(),
  servicoNome: z.string().optional(),
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
})

async function verificarConflito(profissionalId: string, inicio: Date, fim: Date, excluirId?: string) {
  const conflito = await prisma.agendamento.findFirst({
    where: {
      profissionalId,
      status: { in: ['CONFIRMADO', 'REMARCADO'] },
      id: excluirId ? { not: excluirId } : undefined,
      OR: [
        { inicio: { lt: fim }, fim: { gt: inicio } },
      ],
    },
  })
  return conflito !== null
}

export async function agendamentosRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/agendamentos
  app.get('/', { preHandler }, async (request: any) => {
    const { data, profissionalId } = request.query as { data?: string; profissionalId?: string }

    return prisma.agendamento.findMany({
      where: {
        empresaId: request.empresaId,
        ...(profissionalId && { profissionalId }),
        ...(data && {
          inicio: {
            gte: new Date(`${data}T00:00:00Z`),
            lt: new Date(`${data}T23:59:59Z`),
          },
        }),
      },
      include: { profissional: { select: { nome: true } }, lead: { select: { nomeWpp: true, telefone: true } } },
      orderBy: { inicio: 'asc' },
    })
  })

  // POST /app/agendamentos
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = agendamentoBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const inicio = new Date(body.data.inicio)
    const fim = new Date(body.data.fim)

    const temConflito = await verificarConflito(body.data.profissionalId, inicio, fim)
    if (temConflito) return reply.code(409).send({ error: 'Horário em conflito com outro agendamento' })

    return prisma.agendamento.create({
      data: {
        empresaId: request.empresaId,
        profissionalId: body.data.profissionalId,
        leadId: body.data.leadId,
        clienteNome: body.data.clienteNome,
        servicoNome: body.data.servicoNome,
        inicio,
        fim,
      },
    })
  })

  // PUT /app/agendamentos/:id — remarca
  app.put('/:id', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const body = agendamentoBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const existing = await prisma.agendamento.findFirst({
      where: { id, empresaId: request.empresaId },
    })
    if (!existing) return reply.code(404).send({ error: 'Agendamento não encontrado' })

    const inicio = body.data.inicio ? new Date(body.data.inicio) : existing.inicio
    const fim = body.data.fim ? new Date(body.data.fim) : existing.fim
    const profissionalId = body.data.profissionalId ?? existing.profissionalId

    const temConflito = await verificarConflito(profissionalId, inicio, fim, id)
    if (temConflito) return reply.code(409).send({ error: 'Horário em conflito com outro agendamento' })

    return prisma.agendamento.update({
      where: { id },
      data: { profissionalId, inicio, fim, status: 'REMARCADO' },
    })
  })

  // DELETE /app/agendamentos/:id — cancela
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }
    const existing = await prisma.agendamento.findFirst({
      where: { id, empresaId: request.empresaId },
    })
    if (!existing) return reply.code(404).send({ error: 'Agendamento não encontrado' })

    return prisma.agendamento.update({ where: { id }, data: { status: 'CANCELADO' } })
  })
}
