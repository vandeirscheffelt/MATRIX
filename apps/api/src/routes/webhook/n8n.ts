import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { sendEmail } from '../../lib/email.js'

const DEFAULT_TZ = 'America/Sao_Paulo'

// Segredo compartilhado entre Fastify e n8n (aceita header ou query param _s)
async function requireWebhookSecret(request: any, reply: any) {
  const secret = request.headers['x-webhook-secret'] || (request.query as any)['_s']
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
}

const agendamentoBody = z.object({
  empresaId: z.string().uuid(),
  leadTelefone: z.string().optional().transform(v => (v && v.trim()) || null),
  leadNome: z.string().optional(),
  profissionalId: z.string().uuid(),
  inicio: z.string().datetime({ offset: true }),
  fim: z.string().datetime({ offset: true }),
})

const conversaBody = z.object({
  empresaId: z.string().uuid(),
  telefone: z.string(),
})

// Resolve instanceName → empresaId + valida existência
async function resolveInstancia(instanceName: string) {
  return prisma.instanciaWhatsApp.findUnique({
    where: { nomeInstancia: instanceName },
    select: { empresaId: true },
  })
}

// Normaliza telefone para comparação (remove +, espaços, traços)
function normalizarTelefone(tel: string) {
  return tel.replace(/\D/g, '')
}

// Compara dois telefones normalizados tolerando a variação do 9 extra do Brasil
// Ex: 5561995683105 == 556195683105
function telefonesIguais(a: string, b: string): boolean {
  const na = normalizarTelefone(a)
  const nb = normalizarTelefone(b)
  if (na === nb) return true
  // Se um tem 13 dígitos (com 9) e o outro 12 (sem 9), normaliza removendo o 9 na posição 4 (DDI55 + DDD2 + 9)
  const remover9 = (n: string) => n.length === 13 ? n.slice(0, 4) + n.slice(5) : n
  return remover9(na) === remover9(nb)
}

export async function n8nWebhookRoutes(app: FastifyInstance) {

  // GET /webhook/n8n/context/:instanceName
  // Ponto de entrada do n8n: resolve instância → retorna empresaId + config completa
  app.get('/context/:instanceName', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { instanceName } = request.params as { instanceName: string }

    const instancia = await resolveInstancia(instanceName)
    if (!instancia) return reply.code(404).send({ error: 'Instância não encontrada' })

    const { empresaId } = instancia

    const config = await prisma.configBot.findUnique({ where: { empresaId } })

    if (!config) return reply.code(404).send({ error: 'Config não encontrada para esta empresa' })

    // Monta o prompt completo: contexto_operacional (staff/horários) + prompt (persona/abertura)
    const promptCompleto = [config.contextoOperacional, config.prompt]
      .filter(Boolean)
      .join('\n\n')

    return {
      empresaId,
      botAtivo: config.botAtivo,
      prompt: promptCompleto,
      nomeAssistente: config.nomeAssistente,
      palavraPausa: config.palavraPausa,
      palavraRetorno: config.palavraRetorno,
      tempoRetornoMin: config.tempoRetornoMin,
      disponibilidade: config.disponibilidade,
      horarioInicio: config.horarioInicio,
      horarioFim: config.horarioFim,
      idioma: config.idioma,
      faq: config.faq,
    }
  })

  // GET /webhook/n8n/lead/:instanceName/:telefone
  // Verifica se lead existe e se a IA está pausada para esse número
  app.get('/lead/:instanceName/:telefone', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { instanceName, telefone } = request.params as { instanceName: string; telefone: string }

    const instancia = await resolveInstancia(instanceName)
    if (!instancia) return reply.code(404).send({ error: 'Instância não encontrada' })

    const { empresaId } = instancia

    const lead = await prisma.lead.findUnique({
      where: { empresaId_telefone: { empresaId, telefone } },
      include: { conversa: { select: { statusIa: true, pausadoEm: true, retornoEm: true } } },
    })

    if (!lead) {
      return { encontrado: false, iaPausada: false, lead: null }
    }

    const iaPausada = lead.conversa?.statusIa === 'PAUSADO'

    return {
      encontrado: true,
      iaPausada,
      retornoEm: lead.conversa?.retornoEm ?? null,
      lead: {
        id: lead.id,
        nomeWpp: lead.nomeWpp,
        telefone: lead.telefone,
      },
    }
  })

  // POST /webhook/n8n/lead/:instanceName — cria ou atualiza lead pelo n8n
  app.post('/lead/:instanceName', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { instanceName } = request.params as { instanceName: string }

    const instancia = await resolveInstancia(instanceName)
    if (!instancia) return reply.code(404).send({ error: 'Instância não encontrada' })

    const body = z.object({
      telefone: z.string().min(1),
      nomeWpp: z.string().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId } = instancia
    const { telefone, nomeWpp } = body.data

    const lead = await prisma.lead.upsert({
      where: { empresaId_telefone: { empresaId, telefone } },
      create: { empresaId, telefone, nomeWpp },
      update: { ...(nomeWpp ? { nomeWpp } : {}) },
    })

    // Espelhar no CRM (paciente) para que o dono veja todos os contatos
    await (prisma as any).paciente.upsert({
      where: { empresaId_whatsapp: { empresaId, whatsapp: telefone } },
      create: { empresaId, whatsapp: telefone, nome: nomeWpp ?? telefone, origem: 'whatsapp' },
      update: { ...(nomeWpp ? { nome: nomeWpp } : {}) },
    }).catch(() => null)

    return { leadId: lead.id, empresaId }
  })

  // GET /webhook/n8n/config/:empresa_id
  // n8n busca configs para injetar no agente IA
  app.get('/config/:empresaId', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }

    const [config, profissionais] = await Promise.all([
      prisma.configBot.findUnique({ where: { empresaId } }),
      prisma.profissional.findMany({
        where: { empresaId, ativo: true },
        select: { id: true, nome: true, duracaoPadraoMin: true },
      }),
    ])

    if (!config) return reply.code(404).send({ error: 'Config não encontrada' })

    return {
      prompt: config.prompt,
      tom: config.tom,
      palavraPausa: config.palavraPausa,
      palavraRetorno: config.palavraRetorno,
      tempoRetornoMin: config.tempoRetornoMin,
      faq: config.faq,
      botAtivo: config.botAtivo,
      profissionais,
    }
  })

  // POST /webhook/n8n/agendamento
  // n8n chama quando IA confirma um agendamento
  app.post('/agendamento', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = agendamentoBody.safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, leadTelefone, leadNome, profissionalId, inicio, fim } = body.data
    const inicioDate = new Date(inicio)
    const fimDate = new Date(fim)

    // Valida que o profissional pertence a esta empresa
    const profissional = await prisma.profissional.findFirst({
      where: { id: profissionalId, empresaId },
      select: { id: true },
    })
    if (!profissional) return reply.code(400).send({ error: 'profissionalId invalido para esta empresa. Chame listar_profissionais para obter o UUID correto.' })

    // Verifica bloqueio (retorna 200 com campo bloqueado:true para a IA poder oferecer desbloqueio)
    const bloqueio = await prisma.agendamento.findFirst({
      where: {
        profissionalId,
        status: 'BLOQUEADO',
        OR: [{ inicio: { lt: fimDate }, fim: { gt: inicioDate } }],
      },
    })
    if (bloqueio) return reply.send({ sucesso: false, bloqueado: true, mensagem: 'Horario bloqueado neste periodo. Use a tool desbloquear_horario para liberar o horario e entao crie o agendamento novamente.' })

    // Verifica bloqueio na tabela bloqueios (calendario UI Evolia — UTC timestamps)
    const bloqueioCalendario = await prisma.bloqueio.findFirst({
      where: {
        profissionalId,
        dataInicio: { lt: fimDate },
        dataFim: { gt: inicioDate },
      },
    })
    if (bloqueioCalendario) return reply.send({ sucesso: false, bloqueado: true, mensagem: 'Horario bloqueado neste periodo (calendario). Use a tool desbloquear_horario para liberar o horario e entao crie o agendamento novamente.' })

    // Verifica conflito com agendamento existente
    const conflito = await prisma.agendamento.findFirst({
      where: {
        profissionalId,
        status: { in: ['CONFIRMADO', 'REMARCADO'] },
        OR: [{ inicio: { lt: fimDate }, fim: { gt: inicioDate } }],
      },
    })
    if (conflito) return reply.send({ sucesso: false, conflito: true, mensagem: 'Horario em conflito com agendamento ja existente. Verifique a agenda e escolha outro horario.' })

    // Upsert do lead apenas se telefone informado
    let leadId: string | null = null
    if (leadTelefone) {
      const lead = await prisma.lead.upsert({
        where: { empresaId_telefone: { empresaId, telefone: leadTelefone } },
        create: { empresaId, telefone: leadTelefone, nomeWpp: leadNome ?? undefined },
        update: { nomeWpp: leadNome ?? undefined },
      })
      leadId = lead.id
    }

    const agendamento = await prisma.agendamento.create({
      data: {
        empresaId, profissionalId,
        ...(leadId ? { leadId } : {}),
        ...(leadNome ? { clienteNome: leadNome } : {}),
        inicio: inicioDate, fim: fimDate,
      },
    })

    return { sucesso: true, agendamentoId: agendamento.id }
  })

  // POST /webhook/n8n/conversa/pausar
  app.post('/conversa/pausar', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = conversaBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, telefone } = body.data

    // Busca config para saber se usa tempo automático
    const config = await prisma.configBot.findUnique({
      where: { empresaId },
      select: { tempoRetornoMin: true },
    })

    const lead = await prisma.lead.findUnique({
      where: { empresaId_telefone: { empresaId, telefone } },
    })
    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' })

    const retornoEm = config?.tempoRetornoMin
      ? new Date(Date.now() + config.tempoRetornoMin * 60_000)
      : null

    await prisma.conversa.upsert({
      where: { leadId: lead.id },
      create: {
        leadId: lead.id,
        empresaId,
        statusIa: 'PAUSADO',
        pausadoEm: new Date(),
        retornoEm,
      },
      update: { statusIa: 'PAUSADO', pausadoEm: new Date(), retornoEm },
    })

    return { success: true, retornoEm }
  })

  // ─── IA02 — Secretária Interna ───────────────────────────────────────────────

  // GET /webhook/n8n/interno/identificar/:instanceName/:telefone
  // Identifica se o número é gerente, profissional (com aiAccess) ou cliente
  app.get('/interno/identificar/:instanceName/:telefone', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { instanceName, telefone } = request.params as { instanceName: string; telefone: string }

    const instancia = await resolveInstancia(instanceName)
    if (!instancia) return reply.code(404).send({ error: 'Instância não encontrada' })

    const { empresaId } = instancia
    const telNorm = normalizarTelefone(telefone)

    // Verifica gerente
    const gerente = await prisma.numeroGerente.findFirst({
      where: { empresaId },
      select: { telefone: true },
    })

    if (gerente && telefonesIguais(gerente.telefone, telefone)) {
      return { papel: 'gerente', empresaId, profissionalId: null }
    }

    // Verifica profissional com aiAccess
    const profissionais = await prisma.profissional.findMany({
      where: { empresaId, aiAccess: true, ativo: true },
      select: { id: true, telefone: true, nome: true },
    })

    const profissional = profissionais.find(p => p.telefone && telefonesIguais(p.telefone, telefone))
    if (profissional) {
      return { papel: 'profissional', empresaId, profissionalId: profissional.id, nomeProfissional: profissional.nome }
    }

    return { papel: 'cliente', empresaId, profissionalId: null }
  })

  // GET /webhook/n8n/agenda/:empresaId?profissionalId=&data=
  // Retorna agendamentos + quais profissionais atendem no dia (baseado em grade horária).
  app.get('/agenda/:empresaId', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }
    const { profissionalId, data } = request.query as { profissionalId?: string; data?: string }

    const tz = DEFAULT_TZ
    const nowBrasilia = toZonedTime(new Date(), tz)
    const pad = (n: number) => String(n).padStart(2, '0')
    const hoje = `${nowBrasilia.getFullYear()}-${pad(nowBrasilia.getMonth() + 1)}-${pad(nowBrasilia.getDate())}`
    // Aceita só YYYY-MM-DD — qualquer lixo do $fromAI cai para hoje
    const dataRaw = (data && data.trim()) || ''
    const dataStr = /^\d{4}-\d{2}-\d{2}$/.test(dataRaw) ? dataRaw : hoje
    const profissionalIdFinal = (profissionalId && profissionalId.trim()) || undefined
    const inicioDia = fromZonedTime(`${dataStr}T00:00:00`, tz)
    const fimDia = fromZonedTime(`${dataStr}T23:59:59`, tz)
    const diaSemana = toZonedTime(inicioDia, tz).getDay() // 0=dom ... 6=sáb

    const [profissionais, agendamentos] = await Promise.all([
      prisma.profissional.findMany({
        where: { empresaId, ativo: true, ...(profissionalIdFinal ? { id: profissionalIdFinal } : {}) },
        select: { id: true, nome: true, gradeHorarios: true },
      }),
      prisma.agendamento.findMany({
        where: {
          empresaId,
          ...(profissionalIdFinal ? { profissionalId: profissionalIdFinal } : {}),
          status: { in: ['CONFIRMADO', 'REMARCADO', 'BLOQUEADO'] },
          inicio: { gte: inicioDia, lte: fimDia },
        },
        include: {
          lead: { select: { nomeWpp: true, telefone: true } },
          profissional: { select: { nome: true } },
        },
        orderBy: { inicio: 'asc' },
      }),
    ])

    // Converte timestamps UTC → horário de Brasília legível para a IA
    const pad2 = (n: number) => String(n).padStart(2, '0')
    const fmtLocal = (d: Date) => {
      const l = toZonedTime(d, tz)
      return `${l.getFullYear()}-${pad2(l.getMonth() + 1)}-${pad2(l.getDate())}T${pad2(l.getHours())}:${pad2(l.getMinutes())}:00`
    }

    // Profissional atende no dia se: não tem grade configurada (irrestrito) OU tem grade para este dia da semana
    const atendem = profissionais.filter((p: any) =>
      p.gradeHorarios.length === 0 || p.gradeHorarios.some((g: any) => g.diaSemana === diaSemana)
    )
    const naoAtendem = profissionais.filter((p: any) =>
      p.gradeHorarios.length > 0 && !p.gradeHorarios.some((g: any) => g.diaSemana === diaSemana)
    )

    return {
      data: dataStr,
      diaSemana,
      profissionaisQueAtendem: atendem.map((p: any) => {
        const grade = p.gradeHorarios.find((g: any) => g.diaSemana === diaSemana)
        return {
          id: p.id,
          nome: p.nome,
          horaInicio: grade?.horaInicio ?? null,
          horaFim: grade?.horaFim ?? null,
        }
      }),
      profissionaisQueNaoAtendem: naoAtendem.map((p: any) => ({ id: p.id, nome: p.nome })),
      total: agendamentos.length,
      agendamentos: agendamentos.map((ag: any) => ({
        ...ag,
        inicio: fmtLocal(ag.inicio),
        fim: fmtLocal(ag.fim),
      })),
    }
  })

  // GET /webhook/n8n/agenda/:empresaId/relatorio?dataInicio=&dataFim=&profissionalId=
  // Resumo de atendimentos por profissional em um período (padrão: últimas 2 semanas)
  app.get('/agenda/:empresaId/relatorio', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }
    const { dataInicio, dataFim, profissionalId } = request.query as { dataInicio?: string; dataFim?: string; profissionalId?: string }

    const tz = DEFAULT_TZ
    const nowBrasilia = toZonedTime(new Date(), tz)
    const pad = (n: number) => String(n).padStart(2, '0')

    const fimStr = (dataFim && dataFim.trim()) || `${nowBrasilia.getFullYear()}-${pad(nowBrasilia.getMonth() + 1)}-${pad(nowBrasilia.getDate())}`
    let inicioStr = (dataInicio && dataInicio.trim()) || ''
    if (!inicioStr) {
      const d = new Date(`${fimStr}T12:00:00`)
      d.setDate(d.getDate() - 13)
      inicioStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    const profIdFinal = (profissionalId && profissionalId.trim()) || undefined

    const inicioPeriodo = fromZonedTime(`${inicioStr}T00:00:00`, tz)
    const fimPeriodo = fromZonedTime(`${fimStr}T23:59:59`, tz)
    const diasPeriodo = Math.round((new Date(`${fimStr}T12:00:00`).getTime() - new Date(`${inicioStr}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24)) + 1

    const [profissionais, agendamentos] = await Promise.all([
      prisma.profissional.findMany({
        where: { empresaId, ativo: true, ...(profIdFinal ? { id: profIdFinal } : {}) },
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.agendamento.findMany({
        where: {
          empresaId,
          ...(profIdFinal ? { profissionalId: profIdFinal } : {}),
          status: { in: ['CONFIRMADO', 'REMARCADO'] },
          inicio: { gte: inicioPeriodo, lte: fimPeriodo },
        },
        select: { profissionalId: true, inicio: true, fim: true },
      }),
    ])

    const mapa = new Map<string, { count: number; minutos: number; dias: Set<string> }>()
    const fmt = (min: number) => { const h = Math.floor(min / 60), m = min % 60; if (h === 0) return `${m}min`; if (m === 0) return `${h}h`; return `${h}h ${m}min` }

    for (const ag of agendamentos) {
      if (!ag.profissionalId) continue
      const minutos = Math.round((ag.fim.getTime() - ag.inicio.getTime()) / 60_000)
      const local = toZonedTime(ag.inicio, tz)
      const diaStr = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`
      if (!mapa.has(ag.profissionalId)) mapa.set(ag.profissionalId, { count: 0, minutos: 0, dias: new Set() })
      const e = mapa.get(ag.profissionalId)!
      e.count++; e.minutos += minutos; e.dias.add(diaStr)
    }

    const resultado = profissionais.map((p: any) => {
      const d = mapa.get(p.id) ?? { count: 0, minutos: 0, dias: new Set<string>() }
      return { id: p.id, nome: p.nome, atendimentos: d.count, minutosTrabalhados: d.minutos, horasTrabalhadas: fmt(d.minutos), diasAtivos: [...d.dias].sort() }
    })

    return {
      periodo: { inicio: inicioStr, fim: fimStr, dias: diasPeriodo },
      ...(profIdFinal ? { filtroProfissional: profissionais[0]?.nome ?? profIdFinal } : {}),
      profissionais: resultado,
      totalGeral: {
        atendimentos: resultado.reduce((s: number, p: any) => s + p.atendimentos, 0),
        horasTrabalhadas: fmt(resultado.reduce((s: number, p: any) => s + p.minutosTrabalhados, 0)),
      },
    }
  })

  // GET /webhook/n8n/agenda/:empresaId/relatorio-cliente?leadTelefone=&leadNome=&dataInicio=&dataFim=&profissionalId=
  // Histórico de atendimentos de um cliente específico
  app.get('/agenda/:empresaId/relatorio-cliente', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }
    const { leadTelefone, leadNome, dataInicio, dataFim, profissionalId } = request.query as {
      leadTelefone?: string; leadNome?: string; dataInicio?: string; dataFim?: string; profissionalId?: string
    }

    if (!leadTelefone && !leadNome) return reply.code(400).send({ error: 'Informe leadTelefone ou leadNome' })

    const tz = DEFAULT_TZ
    const nowBrasilia = toZonedTime(new Date(), tz)
    const pad = (n: number) => String(n).padStart(2, '0')

    const fimStr = (dataFim && dataFim.trim()) || `${nowBrasilia.getFullYear()}-${pad(nowBrasilia.getMonth() + 1)}-${pad(nowBrasilia.getDate())}`
    let inicioStr = (dataInicio && dataInicio.trim()) || ''
    if (!inicioStr) {
      const d = new Date(`${fimStr}T12:00:00`)
      d.setDate(d.getDate() - 89) // 90 dias padrão para histórico de cliente
      inicioStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }
    const profIdFinal = (profissionalId && profissionalId.trim()) || undefined

    const inicioPeriodo = fromZonedTime(`${inicioStr}T00:00:00`, tz)
    const fimPeriodo = fromZonedTime(`${fimStr}T23:59:59`, tz)

    // Busca lead(s) que correspondam ao filtro
    const leads = await prisma.lead.findMany({
      where: {
        empresaId,
        ...(leadTelefone ? { telefone: { contains: leadTelefone.replace(/\D/g, '').slice(-8) } } : {}),
        ...(leadNome ? { nomeWpp: { contains: leadNome, mode: 'insensitive' } } : {}),
      },
      select: { id: true, nomeWpp: true, telefone: true },
      take: 5, // máximo 5 leads para evitar resposta gigante
    })

    if (leads.length === 0) return { encontrado: false, mensagem: 'Nenhum cliente encontrado com esse filtro.' }

    const leadIds = leads.map((l: any) => l.id)

    const agendamentos = await prisma.agendamento.findMany({
      where: {
        empresaId,
        leadId: { in: leadIds },
        ...(profIdFinal ? { profissionalId: profIdFinal } : {}),
        status: { in: ['CONFIRMADO', 'REMARCADO', 'CANCELADO'] },
        inicio: { gte: inicioPeriodo, lte: fimPeriodo },
      },
      include: {
        profissional: { select: { nome: true } },
        lead: { select: { nomeWpp: true, telefone: true } },
      },
      orderBy: { inicio: 'desc' },
    })

    const fmt = (min: number) => { const h = Math.floor(min / 60), m = min % 60; if (h === 0) return `${m}min`; if (m === 0) return `${h}h`; return `${h}h ${m}min` }

    const historico = agendamentos.map((ag: any) => {
      const local = toZonedTime(ag.inicio, tz)
      const diaStr = `${pad(local.getDate())}/${pad(local.getMonth() + 1)}/${local.getFullYear()}`
      const hora = `${pad(local.getHours())}:${pad(local.getMinutes())}`
      const minutos = Math.round((ag.fim.getTime() - ag.inicio.getTime()) / 60_000)
      return {
        data: diaStr, hora, duracao: fmt(minutos),
        profissional: ag.profissional?.nome ?? '—',
        cliente: ag.lead?.nomeWpp ?? ag.lead?.telefone ?? '—',
        status: ag.status,
      }
    })

    return {
      encontrado: true,
      periodo: { inicio: inicioStr, fim: fimStr },
      clientes: leads.map((l: any) => ({ nome: l.nomeWpp, telefone: l.telefone })),
      totalAtendimentos: historico.filter((h: any) => h.status !== 'CANCELADO').length,
      totalCancelados: historico.filter((h: any) => h.status === 'CANCELADO').length,
      historico,
    }
  })

  // POST /webhook/n8n/agenda/enviar-relatorio-email
  // Gera o relatório de atendimentos e envia por e-mail
  app.post('/agenda/enviar-relatorio-email', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      empresaId: z.string().uuid(),
      emailDestino: z.string().email(),
      dataInicio: z.string().optional(),
      dataFim: z.string().optional(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, emailDestino, dataInicio, dataFim } = body.data
    const tz = DEFAULT_TZ
    const nowBrasilia = toZonedTime(new Date(), tz)
    const pad = (n: number) => String(n).padStart(2, '0')

    const fimStr = (dataFim && dataFim.trim()) || `${nowBrasilia.getFullYear()}-${pad(nowBrasilia.getMonth() + 1)}-${pad(nowBrasilia.getDate())}`
    let inicioStr = (dataInicio && dataInicio.trim()) || ''
    if (!inicioStr) {
      const d = new Date(`${fimStr}T12:00:00`)
      d.setDate(d.getDate() - 13)
      inicioStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    }

    const inicioPeriodo = fromZonedTime(`${inicioStr}T00:00:00`, tz)
    const fimPeriodo = fromZonedTime(`${fimStr}T23:59:59`, tz)

    const [profissionais, agendamentos] = await Promise.all([
      prisma.profissional.findMany({
        where: { empresaId, ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.agendamento.findMany({
        where: { empresaId, status: { in: ['CONFIRMADO', 'REMARCADO'] }, inicio: { gte: inicioPeriodo, lte: fimPeriodo } },
        select: { profissionalId: true, inicio: true, fim: true },
      }),
    ])

    const mapa = new Map<string, { count: number; minutos: number; dias: Set<string> }>()
    for (const ag of agendamentos) {
      if (!ag.profissionalId) continue
      const minutos = Math.round((ag.fim.getTime() - ag.inicio.getTime()) / 60_000)
      const local = toZonedTime(ag.inicio, tz)
      const diaStr = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`
      if (!mapa.has(ag.profissionalId)) mapa.set(ag.profissionalId, { count: 0, minutos: 0, dias: new Set() })
      const e = mapa.get(ag.profissionalId)!
      e.count++; e.minutos += minutos; e.dias.add(diaStr)
    }

    const fmt = (min: number) => {
      const h = Math.floor(min / 60), m = min % 60
      if (h === 0) return `${m}min`; if (m === 0) return `${h}h`; return `${h}h ${m}min`
    }

    const resultado = profissionais.map((p: any) => {
      const d = mapa.get(p.id) ?? { count: 0, minutos: 0, dias: new Set<string>() }
      return { nome: p.nome, atendimentos: d.count, horasTrabalhadas: fmt(d.minutos), minutosTrabalhados: d.minutos, diasAtivos: [...d.dias].sort() }
    })

    const totalAtend = resultado.reduce((s: number, p: any) => s + p.atendimentos, 0)
    const totalMin = resultado.reduce((s: number, p: any) => s + p.minutosTrabalhados, 0)

    const [diaI, mesI, anoI] = [inicioStr.slice(8, 10), inicioStr.slice(5, 7), inicioStr.slice(0, 4)]
    const [diaF, mesF, anoF] = [fimStr.slice(8, 10), fimStr.slice(5, 7), fimStr.slice(0, 4)]
    const periodoLabel = `${diaI}/${mesI}/${anoI} a ${diaF}/${mesF}/${anoF}`

    const linhas = resultado.map((p: any) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb">${p.nome}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center">${p.atendimentos}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;text-align:center">${p.horasTrabalhadas}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${p.diasAtivos.map((d: string) => `${d.slice(8)}/${d.slice(5,7)}`).join(', ') || '—'}</td>
      </tr>`).join('')

    const html = `
    <div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#111827">
      <div style="background:#7c3aed;padding:24px 32px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;color:#fff;font-size:22px">Relatório de Atendimentos</h1>
        <p style="margin:4px 0 0;color:#ddd6fe;font-size:14px">Período: ${periodoLabel}</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:#f9fafb">
              <th style="padding:10px 16px;text-align:left;font-size:13px;color:#6b7280;font-weight:600">Profissional</th>
              <th style="padding:10px 16px;text-align:center;font-size:13px;color:#6b7280;font-weight:600">Atendimentos</th>
              <th style="padding:10px 16px;text-align:center;font-size:13px;color:#6b7280;font-weight:600">Horas</th>
              <th style="padding:10px 16px;text-align:left;font-size:13px;color:#6b7280;font-weight:600">Dias ativos</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
          <tfoot>
            <tr style="background:#f3f4f6;font-weight:700">
              <td style="padding:12px 16px">Total geral</td>
              <td style="padding:12px 16px;text-align:center">${totalAtend}</td>
              <td style="padding:12px 16px;text-align:center">${fmt(totalMin)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#9ca3af;text-align:center">Enviado pela Evolia — sistema de agenda</p>
    </div>`

    await sendEmail({
      to: emailDestino,
      subject: `Relatório de Atendimentos — ${periodoLabel}`,
      html,
    })

    return { success: true, emailDestino, periodo: { inicio: inicioStr, fim: fimStr } }
  })

  // POST /webhook/n8n/agenda/bloquear
  // Cria agendamento de bloqueio (sem lead) para horário vago
  app.post('/agenda/bloquear', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      empresaId: z.string().uuid(),
      profissionalId: z.string().uuid(),
      inicio: z.string(),
      fim: z.string(),
      motivo: z.string().optional(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, profissionalId, inicio, fim, motivo } = body.data
    // Se não tem offset de timezone, interpreta como horário de Brasília
    const parseBR = (s: string) =>
      s.match(/[Zz]$/) || s.match(/[+-]\d{2}:\d{2}$/) ? new Date(s) : fromZonedTime(s, DEFAULT_TZ)
    const inicioDate = parseBR(inicio)
    const fimDate = parseBR(fim)

    const conflito = await prisma.agendamento.findFirst({
      where: {
        profissionalId,
        status: { in: ['CONFIRMADO', 'REMARCADO', 'BLOQUEADO'] },
        OR: [{ inicio: { lt: fimDate }, fim: { gt: inicioDate } }],
      },
    })
    if (conflito) return reply.code(409).send({ error: 'Horário em conflito' })

    const bloqueio = await prisma.agendamento.create({
      data: { empresaId, profissionalId, inicio: inicioDate, fim: fimDate, status: 'BLOQUEADO', observacao: motivo },
    })

    return { success: true, agendamentoId: bloqueio.id }
  })

  // POST /webhook/n8n/agenda/desbloquear
  // Remove o bloqueio exatamente no intervalo informado, preservando as bordas.
  // Ex: bloqueio 08:00–21:00 + desbloquear 12:00–21:00 → sobra 08:00–12:00 bloqueado.
  app.post('/agenda/desbloquear', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      profissionalId: z.string().uuid(),
      inicio: z.string(),
      fim: z.string(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const parseBR = (s: string) =>
      s.match(/[Zz]$/) || s.match(/[+-]\d{2}:\d{2}$/) ? new Date(s) : fromZonedTime(s, DEFAULT_TZ)
    const inicioDate = parseBR(body.data.inicio)
    const fimDate = parseBR(body.data.fim)
    const { profissionalId } = body.data

    // Buscar todos os bloqueios que se sobrepõem ao intervalo
    const bloqueios = await prisma.agendamento.findMany({
      where: {
        profissionalId,
        status: 'BLOQUEADO',
        inicio: { lt: fimDate },
        fim: { gt: inicioDate },
      },
    })

    if (bloqueios.length === 0) return { success: true, desbloqueados: 0 }

    // Para cada bloqueio: cancelar e recriar os pedaços que ficam fora do intervalo
    for (const b of bloqueios) {
      await prisma.agendamento.update({ where: { id: b.id }, data: { status: 'CANCELADO' } })

      // Sobra à esquerda: bloqueio começa antes do intervalo
      if (b.inicio < inicioDate) {
        await prisma.agendamento.create({
          data: { empresaId: b.empresaId, profissionalId, inicio: b.inicio, fim: inicioDate, status: 'BLOQUEADO', observacao: b.observacao },
        })
      }
      // Sobra à direita: bloqueio termina depois do intervalo
      if (b.fim > fimDate) {
        await prisma.agendamento.create({
          data: { empresaId: b.empresaId, profissionalId, inicio: fimDate, fim: b.fim, status: 'BLOQUEADO', observacao: b.observacao },
        })
      }
    }

    return { success: true, desbloqueados: bloqueios.length }
  })

  // POST /webhook/n8n/agenda/remover-bloqueio-calendario
  // Remove bloqueios da tabela bloqueios (calendario UI Evolia) que se sobrepoem ao intervalo.
  app.post('/agenda/remover-bloqueio-calendario', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      profissionalId: z.string().uuid(),
      inicio: z.string(),
      fim: z.string(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const parseBR = (s: string) =>
      s.match(/[Zz]$/) || s.match(/[+-]\d{2}:\d{2}$/) ? new Date(s) : fromZonedTime(s, DEFAULT_TZ)
    const inicioDate = parseBR(body.data.inicio)
    const fimDate = parseBR(body.data.fim)
    const { profissionalId } = body.data

    const removed = await prisma.bloqueio.deleteMany({
      where: {
        profissionalId,
        dataInicio: { lt: fimDate },
        dataFim: { gt: inicioDate },
      },
    })

    return { success: true, removidos: removed.count }
  })

  // POST /webhook/n8n/agenda/cancelar
  app.post('/agenda/cancelar', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      agendamentoId: z.string().uuid(),
      motivo: z.string().optional(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { agendamentoId, motivo } = body.data

    const agendamento = await prisma.agendamento.findUnique({ where: { id: agendamentoId } })
    if (!agendamento) return reply.code(404).send({ error: 'Agendamento não encontrado' })
    if (agendamento.status === 'CANCELADO') return reply.code(409).send({ error: 'Agendamento já cancelado' })

    const atualizado = await prisma.agendamento.update({
      where: { id: agendamentoId },
      data: { status: 'CANCELADO', observacao: motivo },
      include: { lead: { select: { telefone: true, nomeWpp: true } } },
    })

    return {
      success: true,
      temCliente: !!atualizado.leadId,
      leadTelefone: atualizado.lead?.telefone ?? null,
      leadNome: atualizado.lead?.nomeWpp ?? null,
    }
  })

  // POST /webhook/n8n/agenda/reagendar
  app.post('/agenda/reagendar', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      agendamentoId: z.string().uuid(),
      novoInicio: z.string(),
      novoFim: z.string(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { agendamentoId, novoInicio, novoFim } = body.data
    const parseBR = (s: string) =>
      s.match(/[Zz]$/) || s.match(/[+-]\d{2}:\d{2}$/) ? new Date(s) : fromZonedTime(s, DEFAULT_TZ)
    const inicioDate = parseBR(novoInicio)
    const fimDate = parseBR(novoFim)

    const agendamento = await prisma.agendamento.findUnique({ where: { id: agendamentoId } })
    if (!agendamento) return reply.code(404).send({ error: 'Agendamento não encontrado' })

    const conflito = await prisma.agendamento.findFirst({
      where: {
        profissionalId: agendamento.profissionalId,
        id: { not: agendamentoId },
        status: { in: ['CONFIRMADO', 'REMARCADO', 'BLOQUEADO'] },
        OR: [{ inicio: { lt: fimDate }, fim: { gt: inicioDate } }],
      },
    })
    if (conflito) return reply.code(409).send({ error: 'Novo horário em conflito' })

    const atualizado = await prisma.agendamento.update({
      where: { id: agendamentoId },
      data: { inicio: inicioDate, fim: fimDate, status: 'REMARCADO' },
      include: { lead: { select: { telefone: true, nomeWpp: true } } },
    })

    return {
      success: true,
      temCliente: !!atualizado.leadId,
      leadTelefone: atualizado.lead?.telefone ?? null,
      leadNome: atualizado.lead?.nomeWpp ?? null,
      novoInicio: atualizado.inicio,
      novoFim: atualizado.fim,
    }
  })

  // GET /webhook/n8n/agenda/:empresaId/notificacoes-pendentes
  // IA02 consulta fila de notificacoes ainda nao enviadas
  app.get('/agenda/:empresaId/notificacoes-pendentes', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }

    const tz = DEFAULT_TZ
    const notificacoes = await prisma.notificacaoPendente.findMany({
      where: { empresaId, enviada: false },
      include: { lead: { select: { nomeWpp: true, telefone: true } } },
      orderBy: { criadoEm: 'asc' },
    })

    const pad2 = (n: number) => String(n).padStart(2, '0')
    const fmtLocal = (d: Date) => {
      const l = toZonedTime(d, tz)
      return `${pad2(l.getDate())}/${pad2(l.getMonth() + 1)} ${pad2(l.getHours())}:${pad2(l.getMinutes())}`
    }

    return {
      total: notificacoes.length,
      notificacoes: notificacoes.map((n: any) => ({
        id: n.id,
        leadNome: n.lead?.nomeWpp ?? '—',
        leadTelefone: n.lead?.telefone ?? '—',
        mensagem: n.mensagem,
        criadoEm: fmtLocal(n.criadoEm),
      })),
    }
  })

  // POST /webhook/n8n/agenda/cancelar-notificacao
  // IA02 cancela notificacao pendente por id ou por leadTelefone (todas do lead)
  app.post('/agenda/cancelar-notificacao', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      empresaId: z.string().uuid(),
      notificacaoId: z.string().optional(),
      leadTelefone: z.string().optional(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, notificacaoId, leadTelefone } = body.data
    if (!notificacaoId && !leadTelefone) {
      return reply.code(400).send({ error: 'Informe notificacaoId ou leadTelefone' })
    }

    if (notificacaoId) {
      const removed = await prisma.notificacaoPendente.deleteMany({
        where: { id: notificacaoId, empresaId, enviada: false },
      })
      // Remove entrada correspondente do histórico da IA01
      await (prisma as any).$queryRawUnsafe(
        `DELETE FROM public.n8n_chat_histories
         WHERE message->'additional_kwargs'->>'notificacaoId' = $1`,
        notificacaoId
      )
      return { success: true, canceladas: removed.count }
    }

    // Cancela todas as pendentes do lead
    const lead = await prisma.lead.findUnique({
      where: { empresaId_telefone: { empresaId, telefone: leadTelefone! } },
    })
    if (!lead) return reply.send({ success: true, canceladas: 0 })

    // Busca IDs das notificações antes de deletar para limpar o histórico
    const pendentes = await prisma.notificacaoPendente.findMany({
      where: { leadId: lead.id, empresaId, enviada: false },
      select: { id: true },
    })
    const removed = await prisma.notificacaoPendente.deleteMany({
      where: { leadId: lead.id, empresaId, enviada: false },
    })
    // Remove todas as entradas correspondentes do histórico da IA01
    if (pendentes.length > 0) {
      const ids = pendentes.map((p: any) => p.id)
      await (prisma as any).$queryRawUnsafe(
        `DELETE FROM public.n8n_chat_histories
         WHERE message->'additional_kwargs'->>'notificacaoId' = ANY($1::text[])`,
        ids
      )
    }
    return { success: true, canceladas: removed.count }
  })

  // POST /webhook/n8n/agenda/notificar-cliente
  // IA02 solicita que IA01 notifique o cliente (cria registro de notificação pendente)
  app.post('/agenda/notificar-cliente', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      empresaId: z.string().uuid(),
      leadTelefone: z.string(),
      mensagem: z.string().min(1),
      agendamentoId: z.string().uuid().optional(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, leadTelefone, mensagem, agendamentoId } = body.data

    const lead = await prisma.lead.findUnique({
      where: { empresaId_telefone: { empresaId, telefone: leadTelefone } },
    })
    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' })

    const notificacao = await prisma.notificacaoPendente.create({
      data: {
        empresaId,
        leadId: lead.id,
        mensagem,
        ...(agendamentoId ? { agendamentoId } : {}),
      },
    })

    // Injeta a mensagem no histórico da IA01 para que ela tenha contexto quando o cliente responder
    const sessionId = `${leadTelefone}@s.whatsapp.net`
    await (prisma as any).$queryRawUnsafe(
      `INSERT INTO public.n8n_chat_histories (session_id, message) VALUES ($1, $2::jsonb)`,
      sessionId,
      JSON.stringify({
        type: 'ai',
        content: mensagem,
        tool_calls: [],
        additional_kwargs: { origem: 'ia02_notificacao', notificacaoId: notificacao.id },
        response_metadata: {},
        invalid_tool_calls: [],
      })
    )

    return { success: true, notificacaoId: notificacao.id }
  })

  // GET /webhook/n8n/profissionais/:empresaId
  // IA02 usa para resolver nome → profissionalId antes de bloquear/cancelar
  app.get('/profissionais/:empresaId', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }
    const profissionais = await prisma.profissional.findMany({
      where: { empresaId },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    })
    return profissionais
  })

  // GET /webhook/n8n/agenda/:empresaId/bloqueios-calendario?data=&profissionalId=
  // Retorna bloqueios da tabela bloqueios (calendario UI Evolia) para um dia, convertidos para Brasilia
  app.get('/agenda/:empresaId/bloqueios-calendario', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }
    const { data, profissionalId } = request.query as { data?: string; profissionalId?: string }

    if (!data?.trim()) return reply.code(400).send({ error: 'data e obrigatorio (YYYY-MM-DD)' })

    const tz = DEFAULT_TZ
    const inicioDia = fromZonedTime(`${data}T00:00:00`, tz)
    const fimDia = fromZonedTime(`${data}T23:59:59`, tz)

    const profissionaisDaEmpresa = await prisma.profissional.findMany({
      where: { empresaId, ...(profissionalId ? { id: profissionalId } : {}) },
      select: { id: true, nome: true },
    })
    const profIds = profissionaisDaEmpresa.map((p: any) => p.id)

    const bloqueios = await prisma.bloqueio.findMany({
      where: {
        profissionalId: { in: profIds },
        dataInicio: { lt: fimDia },
        dataFim: { gt: inicioDia },
      },
      orderBy: { dataInicio: 'asc' },
    })

    const profMap: Record<string, string> = Object.fromEntries(profissionaisDaEmpresa.map((p: any) => [p.id, p.nome]))
    const pad2 = (n: number) => String(n).padStart(2, '0')
    const fmtLocal = (d: Date) => {
      const l = toZonedTime(d, tz)
      return `${l.getFullYear()}-${pad2(l.getMonth() + 1)}-${pad2(l.getDate())}T${pad2(l.getHours())}:${pad2(l.getMinutes())}:00`
    }

    return bloqueios.map((b: any) => ({
      id: b.id,
      profissionalId: b.profissionalId,
      profissionalNome: profMap[b.profissionalId] ?? b.profissionalId,
      inicio: fmtLocal(b.dataInicio),
      fim: fmtLocal(b.dataFim),
      motivo: b.motivo ?? null,
    }))
  })

  // GET /webhook/n8n/agenda/:empresaId/buscar-lead?nome=
  // IA02 usa para encontrar telefone de um cliente pelo nome antes de criar agendamento
  app.get('/agenda/:empresaId/buscar-lead', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }
    const { nome } = request.query as { nome?: string }
    if (!nome?.trim()) return reply.code(400).send({ error: 'nome é obrigatório' })
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const busca = norm(nome)
    const todos = await prisma.lead.findMany({
      where: { empresaId, nomeWpp: { not: null } },
      select: { telefone: true, nomeWpp: true },
      orderBy: { nomeWpp: 'asc' },
    })
    const leads = todos.filter(l => norm(l.nomeWpp ?? '').includes(busca) && l.telefone).slice(0, 10)
    return { total: leads.length, leads }
  })

  // ─────────────────────────────────────────────────────────────────────────────

  // POST /webhook/n8n/conversa/reativar
  app.post('/conversa/reativar', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = conversaBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, telefone } = body.data

    const lead = await prisma.lead.findUnique({
      where: { empresaId_telefone: { empresaId, telefone } },
    })
    if (!lead) return reply.code(404).send({ error: 'Lead não encontrado' })

    await prisma.conversa.upsert({
      where: { leadId: lead.id },
      create: { leadId: lead.id, empresaId, statusIa: 'ATIVO' },
      update: { statusIa: 'ATIVO', pausadoEm: null, retornoEm: null },
    })

    return { success: true }
  })

  // GET /webhook/n8n/contato-perfil?empresaId=&telefone=
  app.get('/contato-perfil', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const q = z.object({
      empresaId: z.string().uuid(),
      telefone: z.string(),
    }).safeParse(request.query)
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() })

    const perfil = await prisma.contatoPerfil.findUnique({
      where: { empresaId_telefone: { empresaId: q.data.empresaId, telefone: q.data.telefone } },
    })
    return perfil ?? { empresaId: q.data.empresaId, telefone: q.data.telefone, apelido: null, fonte: null }
  })

  // POST /webhook/n8n/contato-perfil
  // Salva ou atualiza o apelido do contato. Nunca sobrescreve se fonte='usuario'.
  app.post('/contato-perfil', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      empresaId: z.string().uuid(),
      telefone: z.string(),
      apelido: z.string().min(1),
      fonte: z.enum(['whatsapp', 'usuario']).default('usuario'),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, telefone, apelido, fonte } = body.data

    // Se já existe com fonte='usuario', não sobrescrever
    const existing = await prisma.contatoPerfil.findUnique({
      where: { empresaId_telefone: { empresaId, telefone } },
    })
    if (existing?.fonte === 'usuario' && fonte !== 'usuario') {
      return { success: true, skipped: true, apelido: existing.apelido }
    }

    const perfil = await prisma.contatoPerfil.upsert({
      where: { empresaId_telefone: { empresaId, telefone } },
      create: { empresaId, telefone, apelido, fonte },
      update: { apelido, fonte },
    })
    return { success: true, skipped: false, apelido: perfil.apelido }
  })

  // GET /webhook/n8n/contato-perfil/email?empresaId=&telefone=
  // IA02 busca o e-mail salvo do gerente antes de enviar relatório
  app.get('/contato-perfil/email', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const q = z.object({
      empresaId: z.string().uuid(),
      telefone: z.string(),
    }).safeParse(request.query)
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() })

    const perfil = await prisma.contatoPerfil.findUnique({
      where: { empresaId_telefone: { empresaId: q.data.empresaId, telefone: q.data.telefone } },
      select: { emailRelatorio: true },
    })
    return { emailRelatorio: perfil?.emailRelatorio ?? null }
  })

  // PATCH /webhook/n8n/contato-perfil/email
  // IA02 salva o e-mail confirmado pelo gerente
  app.patch('/contato-perfil/email', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      empresaId: z.string().uuid(),
      telefone: z.string(),
      emailRelatorio: z.string().email(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, telefone, emailRelatorio } = body.data

    const perfil = await prisma.contatoPerfil.upsert({
      where: { empresaId_telefone: { empresaId, telefone } },
      create: { empresaId, telefone, emailRelatorio },
      update: { emailRelatorio },
    })
    return { success: true, emailRelatorio: perfil.emailRelatorio }
  })
}
