import type { FastifyInstance } from 'fastify'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

export async function leadsRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/leads — CRM
  app.get('/', { preHandler }, async (request: any) => {
    return prisma.lead.findMany({
      where: { empresaId: request.empresaId },
      include: { conversa: { select: { statusIa: true, atualizadoEm: true } } },
      orderBy: { criadoEm: 'desc' },
    })
  })

  // GET /app/leads/:id — detalhe + histórico
  app.get('/:id', { preHandler }, async (request: any, reply) => {
    const { id } = request.params as { id: string }

    const lead = await prisma.lead.findFirst({
      where: { id, empresaId: request.empresaId },
      include: {
        conversa: true,
        agendamentos: {
          orderBy: { inicio: 'desc' },
          include: { profissional: { select: { nome: true } } },
        },
      },
    })
    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' })

    const historico = await prisma.chatHistory.findMany({
      where: { sessionId: lead.telefone, empresaId: request.empresaId },
      orderBy: { criadoEm: 'asc' },
      take: 100,
    })

    return { ...lead, historico }
  })
}
