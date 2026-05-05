import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const dayQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD'),
  profissionalId: z.string().uuid().optional(),
})

const weekQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD (qualquer dia da semana)'),
  profissionalId: z.string().uuid().optional(),
})

type SlotStatus = 'DISPONIVEL' | 'AGENDADO' | 'BLOQUEADO'

interface Slot {
  hora: string        // "08:00"
  horaFim: string     // "09:00"
  duracaoMin: number  // duration in minutes
  status: SlotStatus
  agendamentoId?: string
  bloqueioId?: string
  leadNome?: string
  leadTelefone?: string
  servicoNome?: string
}

interface AgendaDia {
  profissionalId: string
  profissionalNome: string
  data: string
  slots: Slot[]
}

// Gera slots de `horaInicio` até `horaFim` com intervalos de `duracaoMin`
function gerarSlots(horaInicio: string, horaFim: string, duracaoMin: number): Array<{ inicio: Date; fim: Date }> {
  const slots: Array<{ inicio: Date; fim: Date }> = []
  const [hI, mI] = horaInicio.split(':').map(Number)
  const [hF, mF] = horaFim.split(':').map(Number)

  let cursor = hI * 60 + mI
  const fimMin = hF * 60 + mF

  while (cursor <= fimMin) {
    const h = Math.floor(cursor / 60)
    const m = cursor % 60
    const fimCursor = cursor + duracaoMin
    const hFim = Math.floor(fimCursor / 60)
    const mFim = fimCursor % 60

    const inicioDate = new Date(0)
    inicioDate.setUTCHours(h, m, 0, 0)
    const fimDate = new Date(0)
    fimDate.setUTCHours(hFim, mFim, 0, 0)

    slots.push({ inicio: inicioDate, fim: fimDate })
    cursor += duracaoMin
  }
  return slots
}

function toMinutes(date: Date): number {
  return date.getUTCHours() * 60 + date.getUTCMinutes()
}

function formatHora(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

async function calcularAgendaDia(
  empresaId: string,
  profissionalId: string,
  dataStr: string // "YYYY-MM-DD"
): Promise<AgendaDia> {
  const profissional = await prisma.profissional.findFirst({
    where: { id: profissionalId, empresaId, ativo: true },
    include: { gradeHorarios: true, bloqueios: true },
  })

  if (!profissional) throw new Error(`Profissional ${profissionalId} não encontrado`)

  const dataObj = new Date(`${dataStr}T00:00:00Z`)
  const diaSemana = dataObj.getUTCDay() // 0=dom ... 6=sáb

  const hasAnyGrade = profissional.gradeHorarios.length > 0
  const grade = profissional.gradeHorarios.find(g => g.diaSemana === diaSemana)

  // Profissional tem grade configurada mas não trabalha neste dia → retorna sem slots
  if (hasAnyGrade && !grade) {
    return { profissionalId, profissionalNome: profissional.nome, data: dataStr, slots: [] }
  }

  // Sem grade alguma: usa horário padrão 08:00–18:00 como fallback
  const horaInicio = grade?.horaInicio ?? '08:00'
  const horaFim = grade?.horaFim ?? '18:00'
  const duracaoMin = profissional.duracaoPadraoMin ?? 60
  // Always generate 15-min slots so the grid matches the frontend 15-min granularity
  const slotsBrutos = gerarSlots(horaInicio, horaFim, 15)

  // Agendamentos do dia (apenas CONFIRMADO e REMARCADO)
  const inicioDia = new Date(`${dataStr}T00:00:00Z`)
  const fimDia = new Date(`${dataStr}T23:59:59Z`)

  const agendamentos = await prisma.agendamento.findMany({
    where: {
      profissionalId,
      status: { in: ['CONFIRMADO', 'REMARCADO'] },
      inicio: { gte: inicioDia, lte: fimDia },
    },
    include: {
      lead: { select: { nomeWpp: true, telefone: true } },
      servico: { select: { duracaoMin: true } },
    },
  })

  const slots: Slot[] = slotsBrutos.map(({ inicio, fim }) => {
    const slotInicioMin = toMinutes(inicio)
    const slotFimMin = toMinutes(fim)

    // Verifica bloqueio
    const bloqueio = profissional.bloqueios.find((b: { id: string; dataInicio: Date; dataFim: Date }) => {
      const bInicio = new Date(b.dataInicio)
      const bFim = new Date(b.dataFim)
      return bInicio < new Date(`${dataStr}T${formatHora(fim)}:00Z`) &&
             bFim > new Date(`${dataStr}T${formatHora(inicio)}:00Z`)
    })

    if (bloqueio) {
      const bInicioMin = toMinutes(new Date(bloqueio.dataInicio))
      if (bInicioMin !== slotInicioMin) return null as any
      return { hora: formatHora(inicio), horaFim: formatHora(fim), duracaoMin, status: 'BLOQUEADO', bloqueioId: bloqueio.id }
    }

    // Verifica agendamento — only emit AGENDADO for the start slot; inner slots are skipped
    const agendado = agendamentos.find(a => {
      const aInicioMin = toMinutes(a.inicio)
      const aFimMin = toMinutes(a.fim)
      return aInicioMin < slotFimMin && aFimMin > slotInicioMin
    })

    if (agendado) {
      const aInicioMin = toMinutes(agendado.inicio)
      // Only emit the AGENDADO block at the appointment's start slot
      if (aInicioMin !== slotInicioMin) return null as any
      // Prefer service catalog duration (corrects legacy appointments stored with wrong fim)
      const agDuracaoMin = (agendado as any).servico?.duracaoMin
        ?? Math.round((agendado.fim.getTime() - agendado.inicio.getTime()) / 60000)
      return {
        hora: formatHora(inicio),
        horaFim: formatHora(new Date(agendado.fim)),
        duracaoMin: agDuracaoMin,
        status: 'AGENDADO',
        agendamentoId: agendado.id,
        leadNome: agendado.lead?.nomeWpp ?? agendado.lead?.telefone ?? (agendado as any).clienteNome,
        leadTelefone: agendado.lead?.telefone ?? (agendado as any).clienteTelefone,
        servicoNome: (agendado as any).servicoNome,
      }
    }

    return { hora: formatHora(inicio), horaFim: formatHora(fim), duracaoMin: 15, status: 'DISPONIVEL' }
  }).filter(Boolean) as Slot[]

  return { profissionalId, profissionalNome: profissional.nome, data: dataStr, slots }
}

export async function agendaRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/agenda/day?date=YYYY-MM-DD&profissionalId=optional
  app.get('/day', { preHandler }, async (request: any, reply) => {
    const query = dayQuery.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })

    const { date, profissionalId } = query.data

    const profissionais = profissionalId
      ? [{ id: profissionalId }]
      : await prisma.profissional.findMany({
          where: { empresaId: request.empresaId, ativo: true },
          select: { id: true },
        })

    const agendas = await Promise.all(
      profissionais.map(p => calcularAgendaDia(request.empresaId, p.id, date))
    )

    return agendas.filter(a => a.slots.length > 0)
  })

  // GET /app/agenda/week?date=YYYY-MM-DD&profissionalId=optional
  app.get('/week', { preHandler }, async (request: any, reply) => {
    const query = weekQuery.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })

    const { date, profissionalId } = query.data

    // Calcula segunda-feira da semana do date informado
    const ref = new Date(`${date}T00:00:00Z`)
    const diaSemana = ref.getUTCDay()
    const diffParaSegunda = diaSemana === 0 ? -6 : 1 - diaSemana
    const segunda = new Date(ref)
    segunda.setUTCDate(ref.getUTCDate() + diffParaSegunda)

    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(segunda)
      d.setUTCDate(segunda.getUTCDate() + i)
      return d.toISOString().slice(0, 10)
    })

    const profissionais = profissionalId
      ? [{ id: profissionalId }]
      : await prisma.profissional.findMany({
          where: { empresaId: request.empresaId, ativo: true },
          select: { id: true },
        })

    const resultado: Record<string, AgendaDia[]> = {}

    for (const dia of dias) {
      const agendas = await Promise.all(
        profissionais.map(p => calcularAgendaDia(request.empresaId, p.id, dia))
      )
      resultado[dia] = agendas.filter(a => a.slots.length > 0)
    }

    return resultado
  })
}
