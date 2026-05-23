import type { FastifyInstance } from 'fastify'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

async function espelharLeadNoCrm(empresaId: string, telefone: string, nome: string | null) {
  await (prisma as any).paciente.upsert({
    where: { empresaId_whatsapp: { empresaId, whatsapp: telefone } },
    create: { empresaId, whatsapp: telefone, nome: nome ?? telefone, origem: 'whatsapp' },
    update: { ...(nome ? { nome } : {}) },
  })
}

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

  // POST /app/leads/sync-crm — espelha todos os leads existentes no CRM (paciente)
  app.post('/sync-crm', { preHandler }, async (request: any) => {
    const leads = await prisma.lead.findMany({
      where: { empresaId: request.empresaId },
      select: { telefone: true, nomeWpp: true },
    })

    let criados = 0
    let atualizados = 0

    for (const lead of leads) {
      const existing = await (prisma as any).paciente.findFirst({
        where: { empresaId: request.empresaId, whatsapp: lead.telefone },
        select: { id: true },
      })
      await espelharLeadNoCrm(request.empresaId, lead.telefone, lead.nomeWpp ?? null)
      existing ? atualizados++ : criados++
    }

    return { total: leads.length, criados, atualizados }
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
