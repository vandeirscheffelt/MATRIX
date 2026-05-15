import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'

// Segredo compartilhado entre Fastify e n8n
async function requireWebhookSecret(request: any, reply: any) {
  const secret = request.headers['x-webhook-secret']
  if (secret !== process.env.N8N_WEBHOOK_SECRET) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
}

const agendamentoBody = z.object({
  empresaId: z.string().uuid(),
  leadTelefone: z.string(),
  leadNome: z.string().optional(),
  profissionalId: z.string().uuid(),
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
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
    const body = agendamentoBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, leadTelefone, leadNome, profissionalId, inicio, fim } = body.data
    const inicioDate = new Date(inicio)
    const fimDate = new Date(fim)

    // Verifica conflito
    const conflito = await prisma.agendamento.findFirst({
      where: {
        profissionalId,
        status: { in: ['CONFIRMADO', 'REMARCADO'] },
        OR: [{ inicio: { lt: fimDate }, fim: { gt: inicioDate } }],
      },
    })
    if (conflito) return reply.code(409).send({ error: 'Horário em conflito' })

    // Upsert do lead
    const lead = await prisma.lead.upsert({
      where: { empresaId_telefone: { empresaId, telefone: leadTelefone } },
      create: { empresaId, telefone: leadTelefone, nomeWpp: leadNome },
      update: { nomeWpp: leadNome },
    })

    const agendamento = await prisma.agendamento.create({
      data: { empresaId, profissionalId, leadId: lead.id, inicio: inicioDate, fim: fimDate },
    })

    return { success: true, agendamentoId: agendamento.id }
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
  // Retorna agendamentos do dia (ou data informada). Se profissionalId, filtra só os dele.
  app.get('/agenda/:empresaId', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }
    const { profissionalId, data } = request.query as { profissionalId?: string; data?: string }

    const dataAlvo = data ? new Date(data) : new Date()
    const inicioDia = new Date(dataAlvo)
    inicioDia.setHours(0, 0, 0, 0)
    const fimDia = new Date(dataAlvo)
    fimDia.setHours(23, 59, 59, 999)

    const agendamentos = await prisma.agendamento.findMany({
      where: {
        empresaId,
        ...(profissionalId ? { profissionalId } : {}),
        status: { in: ['CONFIRMADO', 'REMARCADO'] },
        inicio: { gte: inicioDia, lte: fimDia },
      },
      include: {
        lead: { select: { nomeWpp: true, telefone: true } },
        profissional: { select: { nome: true } },
      },
      orderBy: { inicio: 'asc' },
    })

    return { total: agendamentos.length, agendamentos }
  })

  // POST /webhook/n8n/agenda/bloquear
  // Cria agendamento de bloqueio (sem lead) para horário vago
  app.post('/agenda/bloquear', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      empresaId: z.string().uuid(),
      profissionalId: z.string().uuid(),
      inicio: z.string().datetime(),
      fim: z.string().datetime(),
      motivo: z.string().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, profissionalId, inicio, fim, motivo } = body.data
    const inicioDate = new Date(inicio)
    const fimDate = new Date(fim)

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

  // POST /webhook/n8n/agenda/cancelar
  app.post('/agenda/cancelar', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      agendamentoId: z.string().uuid(),
      motivo: z.string().optional(),
    }).safeParse(request.body)
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
      novoInicio: z.string().datetime(),
      novoFim: z.string().datetime(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { agendamentoId, novoInicio, novoFim } = body.data
    const inicioDate = new Date(novoInicio)
    const fimDate = new Date(novoFim)

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

  // POST /webhook/n8n/agenda/notificar-cliente
  // IA02 solicita que IA01 notifique o cliente (cria registro de notificação pendente)
  app.post('/agenda/notificar-cliente', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const body = z.object({
      empresaId: z.string().uuid(),
      leadTelefone: z.string(),
      mensagem: z.string().min(1),
      agendamentoId: z.string().uuid().optional(),
    }).safeParse(request.body)
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

    return { success: true, notificacaoId: notificacao.id }
  })

  // GET /webhook/n8n/profissionais/:empresaId
  // IA02 usa para resolver nome → profissionalId antes de bloquear/cancelar
  app.get('/profissionais/:empresaId', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }
    const profissionais = await prisma.profissional.findMany({
      where: { empresaId },
      select: { id: true, nome: true, cargo: true },
      orderBy: { nome: 'asc' },
    })
    return profissionais
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
}
