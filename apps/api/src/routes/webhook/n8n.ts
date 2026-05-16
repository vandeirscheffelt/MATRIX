import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'
import { sendEmail } from '../../lib/email.js'

const DEFAULT_TZ = 'America/Sao_Paulo'

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
  // Retorna agendamentos + quais profissionais atendem no dia (baseado em grade horária).
  app.get('/agenda/:empresaId', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }
    const { profissionalId, data } = request.query as { profissionalId?: string; data?: string }

    const tz = DEFAULT_TZ
    const nowBrasilia = toZonedTime(new Date(), tz)
    // Empty string from $fromAI() default → treat as "today" / "all professionals"
    const dataStr = (data && data.trim()) || `${nowBrasilia.getFullYear()}-${String(nowBrasilia.getMonth() + 1).padStart(2, '0')}-${String(nowBrasilia.getDate()).padStart(2, '0')}`
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
      profissionaisQueAtendem: atendem.map((p: any) => ({ id: p.id, nome: p.nome })),
      profissionaisQueNaoAtendem: naoAtendem.map((p: any) => ({ id: p.id, nome: p.nome })),
      total: agendamentos.length,
      agendamentos,
    }
  })

  // GET /webhook/n8n/agenda/:empresaId/relatorio?dataInicio=YYYY-MM-DD&dataFim=YYYY-MM-DD
  // Resumo de atendimentos por profissional em um período (padrão: últimas 2 semanas)
  app.get('/agenda/:empresaId/relatorio', { preHandler: requireWebhookSecret }, async (request: any, reply) => {
    const { empresaId } = request.params as { empresaId: string }
    const { dataInicio, dataFim } = request.query as { dataInicio?: string; dataFim?: string }

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
    const diasPeriodo = Math.round((new Date(`${fimStr}T12:00:00`).getTime() - new Date(`${inicioStr}T12:00:00`).getTime()) / (1000 * 60 * 60 * 24)) + 1

    const [profissionais, agendamentos] = await Promise.all([
      prisma.profissional.findMany({
        where: { empresaId, ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.agendamento.findMany({
        where: {
          empresaId,
          status: { in: ['CONFIRMADO', 'REMARCADO'] },
          inicio: { gte: inicioPeriodo, lte: fimPeriodo },
        },
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
      e.count++
      e.minutos += minutos
      e.dias.add(diaStr)
    }

    const fmt = (min: number) => {
      const h = Math.floor(min / 60), m = min % 60
      if (h === 0) return `${m}min`
      if (m === 0) return `${h}h`
      return `${h}h ${m}min`
    }

    const resultado = profissionais.map((p: any) => {
      const d = mapa.get(p.id) ?? { count: 0, minutos: 0, dias: new Set<string>() }
      return { id: p.id, nome: p.nome, atendimentos: d.count, minutosTrabalhados: d.minutos, horasTrabalhadas: fmt(d.minutos), diasAtivos: [...d.dias].sort() }
    })

    return {
      periodo: { inicio: inicioStr, fim: fimStr, dias: diasPeriodo },
      profissionais: resultado,
      totalGeral: {
        atendimentos: resultado.reduce((s: number, p: any) => s + p.atendimentos, 0),
        horasTrabalhadas: fmt(resultado.reduce((s: number, p: any) => s + p.minutosTrabalhados, 0)),
      },
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
      inicio: z.coerce.date(),
      fim: z.coerce.date(),
      motivo: z.string().optional(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { empresaId, profissionalId, inicio, fim, motivo } = body.data
    const inicioDate = inicio
    const fimDate = fim

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
      novoInicio: z.coerce.date(),
      novoFim: z.coerce.date(),
    }).safeParse({ ...request.body as any, ...request.query as any })
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { agendamentoId, novoInicio, novoFim } = body.data
    const inicioDate = novoInicio
    const fimDate = novoFim

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
