import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'
import { toZonedTime } from 'date-fns-tz'

const DEFAULT_TZ = 'America/Sao_Paulo'

async function verificarLimiteHorario(
  empresaId: string,
  profissionalId: string,
  inicio: Date,
  fim: Date
): Promise<string | null> {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { timezone: true } })
  const tz = empresa?.timezone ?? DEFAULT_TZ

  const inicioLocal = toZonedTime(inicio, tz)
  const fimLocal = toZonedTime(fim, tz)

  if (fimLocal.getDate() !== inicioLocal.getDate()) {
    return 'Agendamento termina no dia seguinte — fora do horário de atendimento'
  }

  const diaSemana = inicioLocal.getDay()
  const profissional = await prisma.profissional.findFirst({
    where: { id: profissionalId, empresaId },
    include: { gradeHorarios: { where: { diaSemana } } },
  })

  if (!profissional) return null
  const grade = (profissional as any).gradeHorarios?.[0]
  if (!grade?.horaFim) return null

  const [hF, mF] = (grade.horaFim as string).split(':').map(Number)
  const horaFimMin = hF * 60 + mF
  const fimLocalMin = fimLocal.getHours() * 60 + fimLocal.getMinutes()

  if (fimLocalMin > horaFimMin) {
    const fimStr = `${String(fimLocal.getHours()).padStart(2, '0')}:${String(fimLocal.getMinutes()).padStart(2, '0')}`
    return `Agendamento terminaria às ${fimStr}, mas ${(profissional as any).nome} atende até ${grade.horaFim}`
  }

  return null
}

// Telefone WhatsApp BR: 55 + DDD (2 dígitos) + 9 dígitos (celular) = 13 dígitos
const telefoneRegex = /^55\d{2}9\d{8}$/

const agendamentoBody = z.object({
  profissionalId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  clienteNome: z.string().optional(),
  clienteTelefone: z.string().optional().refine(
    v => !v || telefoneRegex.test(v.replace(/\D/g, '')),
    { message: 'Telefone inválido. Use o formato 55DDD + número (ex: 5561999998888)' }
  ),
  servicoNome: z.string().optional(),
  servicoId: z.string().uuid().optional(),
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
    let fim = new Date(body.data.fim)
    let servicoNome = body.data.servicoNome

    let servicoOrientacoes: string | null = null
    if (body.data.servicoId) {
      const servico = await (prisma as any).servico.findFirst({
        where: { id: body.data.servicoId, empresaId: request.empresaId },
      })
      if (servico) {
        fim = new Date(inicio.getTime() + servico.duracaoMin * 60 * 1000)
        servicoNome = servico.nome
        servicoOrientacoes = servico.orientacoes ?? null
      }
    }

    const erroLimite = await verificarLimiteHorario(request.empresaId, body.data.profissionalId, inicio, fim)
    if (erroLimite) return reply.code(422).send({ error: erroLimite })

    const temConflito = await verificarConflito(body.data.profissionalId, inicio, fim)
    if (temConflito) return reply.code(409).send({ error: 'Horário em conflito com outro agendamento' })

    // Upsert lead pelo telefone para garantir vínculo e permitir notificações
    let leadId = body.data.leadId ?? null
    const telefone = body.data.clienteTelefone ? body.data.clienteTelefone.replace(/\D/g, '') : null
    if (telefone && !leadId) {
      const lead = await (prisma as any).lead.upsert({
        where: { empresaId_telefone: { empresaId: request.empresaId, telefone } },
        update: { nomeWpp: body.data.clienteNome ?? undefined },
        create: {
          empresaId: request.empresaId,
          telefone,
          nomeWpp: body.data.clienteNome ?? telefone,
        },
      })
      leadId = lead.id
    }

    const agendamento = await prisma.agendamento.create({
      data: {
        empresaId: request.empresaId,
        profissionalId: body.data.profissionalId,
        leadId,
        clienteNome: body.data.clienteNome,
        clienteTelefone: telefone,
        servicoNome,
        servicoId: body.data.servicoId,
        inicio,
        fim,
      },
    })

    // Disparar orientações pós-agendamento via Evolution API se houver
    if (servicoOrientacoes && telefone) {
      const nome = body.data.clienteNome ? body.data.clienteNome.split(' ')[0] : ''
      const mensagem = nome
        ? `Ola ${nome}! Seguem as orientacoes para o seu agendamento:\n\n${servicoOrientacoes}`
        : `Seguem as orientacoes para o seu agendamento:\n\n${servicoOrientacoes}`

      fetch(`http://localhost:8080/message/sendText/Evolia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY ?? '' },
        body: JSON.stringify({ number: telefone, text: mensagem }),
      }).catch(() => null) // fire-and-forget
    }

    return agendamento
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

    const erroLimite = await verificarLimiteHorario(request.empresaId, profissionalId, inicio, fim)
    if (erroLimite) return reply.code(422).send({ error: erroLimite })

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
