import type { FastifyInstance } from 'fastify'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

export async function dashboardRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/dashboard/overview
  app.get('/overview', { preHandler }, async (request: any) => {
    const empresaId = request.empresaId
    const agora = new Date()

    const inicioDia = new Date(agora)
    inicioDia.setHours(0, 0, 0, 0)
    const fimDia = new Date(agora)
    fimDia.setHours(23, 59, 59, 999)

    const [
      agendamentosHoje,
      proximosAgendamentos,
      conversasAtivas,
      conversasPendentes,
      configBot,
      instancia,
      profissionais,
    ] = await Promise.all([
      // Todos agendamentos do dia
      prisma.agendamento.findMany({
        where: {
          empresaId,
          inicio: { gte: inicioDia, lte: fimDia },
          status: { in: ['CONFIRMADO', 'REMARCADO'] },
        },
        include: {
          profissional: { select: { nome: true } },
          lead: { select: { nomeWpp: true, telefone: true } },
        },
        orderBy: { inicio: 'asc' },
      }),

      // Próximos 5 agendamentos a partir de agora
      prisma.agendamento.findMany({
        where: {
          empresaId,
          inicio: { gte: agora },
          status: { in: ['CONFIRMADO', 'REMARCADO'] },
        },
        include: {
          profissional: { select: { nome: true } },
          lead: { select: { nomeWpp: true, telefone: true } },
        },
        orderBy: { inicio: 'asc' },
        take: 5,
      }),

      // Conversas ativas (IA rodando)
      prisma.conversa.count({
        where: { empresaId, statusIa: 'ATIVO', arquivada: false },
      }),

      // Conversas com IA pausada (aguardando humano)
      prisma.conversa.count({
        where: { empresaId, statusIa: 'PAUSADO', arquivada: false },
      }),

      // Status do bot
      prisma.configBot.findUnique({
        where: { empresaId },
        select: { botAtivo: true },
      }),

      // Status do WhatsApp
      prisma.instanciaWhatsApp.findUnique({
        where: { empresaId },
        select: { status: true },
      }),

      // Profissionais ativos (para calcular vagas)
      prisma.profissional.findMany({
        where: { empresaId, ativo: true },
        include: {
          gradeHorarios: true,
          bloqueios: {
            where: {
              dataInicio: { lte: fimDia },
              dataFim: { gte: inicioDia },
            },
          },
        },
      }),
    ])

    // Calcula vagas do dia
    const diaSemana = agora.getDay()
    let vagasTotais = 0
    let vagasBloqueadas = 0

    for (const prof of profissionais) {
      const grade = prof.gradeHorarios.find(g => g.diaSemana === diaSemana)
      if (!grade) continue

      const [hI, mI] = grade.horaInicio.split(':').map(Number)
      const [hF, mF] = grade.horaFim.split(':').map(Number)
      const totalMin = (hF * 60 + mF) - (hI * 60 + mI)
      const slotsProf = Math.floor(totalMin / prof.duracaoPadraoMin)

      vagasTotais += slotsProf
      vagasBloqueadas += prof.bloqueios.length > 0 ? slotsProf : 0
    }

    const vagasAgendadas = agendamentosHoje.length
    const vagasLivres = Math.max(0, vagasTotais - vagasAgendadas - vagasBloqueadas)

    const fmtHora = (d: Date) => {
      // Converte para horário de Brasília (UTC-3)
      const br = new Date(d.getTime() - 3 * 60 * 60 * 1000)
      return br.toISOString().slice(11, 16)
    }

    const nomeCliente = (a: any) =>
      (a as any).clienteNome ?? a.lead?.nomeWpp ?? a.lead?.telefone ?? 'Lead'

    // Timeline do dia (agendamentos ordenados)
    const timeline = agendamentosHoje.map(a => ({
      tipo: 'agendamento' as const,
      hora: fmtHora(a.inicio),
      cliente: nomeCliente(a),
      profissional: a.profissional.nome,
      servico: (a as any).servicoNome ?? '',
      id: a.id,
    }))

    // Próximas ações (próximos agendamentos)
    const proximaAcao = proximosAgendamentos.map(a => ({
      hora: fmtHora(a.inicio),
      cliente: nomeCliente(a),
      profissional: a.profissional.nome,
      servico: (a as any).servicoNome ?? '',
      agendamentoId: a.id,
    }))

    return {
      // KPIs do dia
      total_compromissos_hoje: agendamentosHoje.length,
      proximos_compromissos_count: proximosAgendamentos.length,
      total_conversas_ativas: conversasAtivas,
      total_conversas_pendentes: conversasPendentes,
      vagas_livres_hoje: vagasLivres,
      vagas_bloqueadas_hoje: vagasBloqueadas,

      // Status dos sistemas
      ia_status: configBot?.botAtivo ? 'ativa' : 'pausada',
      whatsapp_status: instancia?.status ?? 'DISCONNECTED',
      sistema_status: 'online',

      // Listas
      proxima_acao: proximaAcao,
      timeline,
    }
  })
}
