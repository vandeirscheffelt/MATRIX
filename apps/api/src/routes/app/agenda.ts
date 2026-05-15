import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { prisma } from '@boilerplate/database'

const DEFAULT_TZ = 'America/Sao_Paulo'
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

function formatHora(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
}

// Returns minutes-since-midnight for a Date whose UTC fields represent local HH:mm (slot objects)
function slotToMin(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes()
}

// Returns minutes-since-midnight for a real UTC timestamp interpreted in the given timezone
function utcToLocalMin(d: Date, tz: string): number {
  const zoned = toZonedTime(d, tz)
  return zoned.getHours() * 60 + zoned.getMinutes()
}

async function calcularAgendaDia(
  empresaId: string,
  profissionalId: string,
  dataStr: string, // "YYYY-MM-DD"
  tz: string
): Promise<AgendaDia> {
  const profissional = await prisma.profissional.findFirst({
    where: { id: profissionalId, empresaId, ativo: true },
    include: { gradeHorarios: true, bloqueios: true },
  })

  if (!profissional) throw new Error(`Profissional ${profissionalId} não encontrado`)

  // Determine day-of-week in the company's timezone
  const inicioDiaUtc = fromZonedTime(`${dataStr}T00:00:00`, tz)
  const fimDiaUtc = fromZonedTime(`${dataStr}T23:59:59`, tz)
  const diaSemana = toZonedTime(inicioDiaUtc, tz).getDay() // 0=dom ... 6=sáb

  const hasAnyGrade = profissional.gradeHorarios.length > 0
  const grade = profissional.gradeHorarios.find((g: any) => g.diaSemana === diaSemana)

  if (hasAnyGrade && !grade) {
    return { profissionalId, profissionalNome: profissional.nome, data: dataStr, slots: [] }
  }

  const horaInicio = grade?.horaInicio ?? '08:00'
  const horaFim = grade?.horaFim ?? '18:00'
  const duracaoMin = profissional.duracaoPadraoMin ?? 60
  const slotsBrutos = gerarSlots(horaInicio, horaFim, 15)

  // Query agendamentos using company-timezone day bounds (real UTC)
  console.log(`[agenda] ${profissionalId} ${dataStr} inicioDiaUtc=${inicioDiaUtc.toISOString()} fimDiaUtc=${fimDiaUtc.toISOString()}`)
  const agendamentos = await prisma.agendamento.findMany({
    where: {
      profissionalId,
      status: { in: ['CONFIRMADO', 'REMARCADO', 'BLOQUEADO'] },
      inicio: { gte: inicioDiaUtc, lte: fimDiaUtc },
    },
    include: {
      lead: { select: { nomeWpp: true, telefone: true } },
      servico: { select: { duracaoMin: true } },
    },
  })

  console.log(`[agenda] agendamentos encontrados: ${agendamentos.length}`, agendamentos.map((a: any) => ({ id: a.id, status: a.status, inicio: a.inicio })))

  // Intervalo de almoço em minutos (valores locais armazenados como "HH:MM")
  const intervaloInicioMin = profissional.intervaloInicio
    ? (() => { const [h, m] = (profissional.intervaloInicio as string).split(':').map(Number); return h * 60 + m })()
    : null
  const intervaloFimMin = profissional.intervaloFim
    ? (() => { const [h, m] = (profissional.intervaloFim as string).split(':').map(Number); return h * 60 + m })()
    : null

  const slots: Slot[] = slotsBrutos.map(({ inicio, fim }) => {
    const slotInicioMin = slotToMin(inicio)
    const slotFimMin = slotToMin(fim)

    // Verifica intervalo de almoço
    if (intervaloInicioMin !== null && intervaloFimMin !== null) {
      if (slotInicioMin >= intervaloInicioMin && slotFimMin <= intervaloFimMin) {
        if (slotInicioMin === intervaloInicioMin) {
          return {
            hora: formatHora(inicio),
            horaFim: `${String(Math.floor(intervaloFimMin / 60)).padStart(2, '0')}:${String(intervaloFimMin % 60).padStart(2, '0')}`,
            duracaoMin: intervaloFimMin - intervaloInicioMin,
            status: 'BLOQUEADO' as SlotStatus,
          }
        }
        return null as any
      }
    }

    // Verifica bloqueio — compare UTC bloqueio times against local slot window
    const bloqueio = profissional.bloqueios.find((b: { id: string; dataInicio: Date; dataFim: Date }) => {
      const bInicio = fromZonedTime(`${dataStr}T${formatHora(fim)}:00`, tz)
      const bFim = fromZonedTime(`${dataStr}T${formatHora(inicio)}:00`, tz)
      return new Date(b.dataInicio) < bInicio && new Date(b.dataFim) > bFim
    })

    if (bloqueio) {
      const bInicioMin = utcToLocalMin(new Date(bloqueio.dataInicio), tz)
      if (bInicioMin !== slotInicioMin) return null as any
      return { hora: formatHora(inicio), horaFim: formatHora(fim), duracaoMin, status: 'BLOQUEADO', bloqueioId: bloqueio.id }
    }

    // Verifica agendamento — compare UTC agendamento times against local slot window
    const agendado = agendamentos.find((a: any) => {
      const aInicioMin = utcToLocalMin(a.inicio, tz)
      const aFimMin = utcToLocalMin(a.fim, tz)
      return aInicioMin < slotFimMin && aFimMin > slotInicioMin
    })

    if (agendado) {
      const aInicioMin = utcToLocalMin((agendado as any).inicio, tz)
      if (aInicioMin !== slotInicioMin) return null as any
      const agFimZoned = toZonedTime((agendado as any).fim, tz)
      const agFimHora = `${String(agFimZoned.getHours()).padStart(2, '0')}:${String(agFimZoned.getMinutes()).padStart(2, '0')}`
      const agDuracaoMin = (agendado as any).servico?.duracaoMin
        ?? Math.round(((agendado as any).fim.getTime() - (agendado as any).inicio.getTime()) / 60000)
      if ((agendado as any).status === 'BLOQUEADO') {
        return {
          hora: formatHora(inicio),
          horaFim: agFimHora,
          duracaoMin: agDuracaoMin,
          status: 'BLOQUEADO' as SlotStatus,
          agendamentoId: (agendado as any).id,
        }
      }
      return {
        hora: formatHora(inicio),
        horaFim: agFimHora,
        duracaoMin: agDuracaoMin,
        status: 'AGENDADO',
        agendamentoId: (agendado as any).id,
        leadNome: (agendado as any).lead?.nomeWpp ?? (agendado as any).lead?.telefone ?? (agendado as any).clienteNome,
        leadTelefone: (agendado as any).lead?.telefone ?? (agendado as any).clienteTelefone,
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

    const empresa = await prisma.empresa.findUnique({
      where: { id: request.empresaId },
      select: { timezone: true },
    })
    const tz = empresa?.timezone ?? DEFAULT_TZ

    const profissionais = profissionalId
      ? [{ id: profissionalId }]
      : await prisma.profissional.findMany({
          where: { empresaId: request.empresaId, ativo: true },
          select: { id: true },
        })

    const agendas = await Promise.all(
      profissionais.map((p: any) => calcularAgendaDia(request.empresaId, p.id, date, tz))
    )

    return agendas.filter((a: any) => a.slots.length > 0)
  })

  // GET /app/agenda/week?date=YYYY-MM-DD&profissionalId=optional
  app.get('/week', { preHandler }, async (request: any, reply) => {
    const query = weekQuery.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })

    const { date, profissionalId } = query.data

    const empresa = await prisma.empresa.findUnique({
      where: { id: request.empresaId },
      select: { timezone: true },
    })
    const tz = empresa?.timezone ?? DEFAULT_TZ

    // Calcula segunda-feira da semana considerando o timezone da empresa
    const ref = fromZonedTime(`${date}T00:00:00`, tz)
    const diaSemanaLocal = toZonedTime(ref, tz).getDay()
    const diffParaSegunda = diaSemanaLocal === 0 ? -6 : 1 - diaSemanaLocal
    const segundaUtc = new Date(ref)
    segundaUtc.setUTCDate(ref.getUTCDate() + diffParaSegunda)

    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(segundaUtc)
      d.setUTCDate(segundaUtc.getUTCDate() + i)
      // Return date string in company timezone
      const zoned = toZonedTime(d, tz)
      return `${zoned.getFullYear()}-${String(zoned.getMonth() + 1).padStart(2, '0')}-${String(zoned.getDate()).padStart(2, '0')}`
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
        profissionais.map((p: any) => calcularAgendaDia(request.empresaId, p.id, dia, tz))
      )
      resultado[dia] = agendas.filter((a: any) => a.slots.length > 0)
    }

    return resultado
  })
}
