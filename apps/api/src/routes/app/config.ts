import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const TIPO_PT: Record<string, string> = {
  'Restaurant': 'Restaurante',
  'Clinic': 'Clínica',
  'Salon': 'Salão de Beleza',
  'Gym': 'Academia',
  'Real Estate': 'Imobiliária',
  'Consulting': 'Consultoria',
  'E-commerce': 'E-commerce',
  'Other': 'Outro',
}

const configBody = z.object({
  prompt: z.string().min(1).optional(),
  tom: z.enum(['FORMAL', 'INFORMAL']).optional(),
  palavraPausa: z.string().optional(),
  palavraRetorno: z.string().optional(),
  tempoRetornoMin: z.number().int().positive().nullable().optional(),
  faq: z.array(z.object({ pergunta: z.string(), resposta: z.string() })).optional(),
  botAtivo: z.boolean().optional(),
})

async function buildPromptContext(empresaId: string): Promise<string> {
  const [config, profissionais, keywords] = await Promise.all([
    prisma.configBot.findUnique({ where: { empresaId } }),
    prisma.profissional.findMany({
      where: { empresaId, ativo: true },
      include: {
        gradeHorarios: { orderBy: { diaSemana: 'asc' } },
        profissionalServicos: { include: { servico: true } },
      },
    }),
    prisma.keyword.findMany({ where: { empresaId } }),
  ])

  const parts: string[] = []

  if (config?.tipoNegocio) parts.push(`Tipo de negócio: ${TIPO_PT[config.tipoNegocio] ?? config.tipoNegocio}`)
  if (config?.horarioInicio && config?.horarioFim)
    parts.push(`Horário de funcionamento: ${config.horarioInicio} às ${config.horarioFim}`)
  if (keywords.length > 0)
    parts.push(`Palavras-chave do negócio: ${keywords.map((k: any) => k.palavra).join(', ')}`)

  if (profissionais.length > 0) {
    const profs = profissionais.map((p: any) => {
      const servicos = p.profissionalServicos.map((ps: any) => ps.servico.nome).join(', ')
      const grade = p.gradeHorarios
        .map((g: any) => `${DIAS_SEMANA[g.diaSemana]} ${g.horaInicio}-${g.horaFim}`)
        .join(', ')
      const intervalo = p.intervaloInicio && p.intervaloFim
        ? ` (intervalo ${p.intervaloInicio}-${p.intervaloFim})`
        : ''
      return `- ${p.nome}${servicos ? `: ${servicos}` : ''}${grade ? ` | atende: ${grade}${intervalo}` : ''}`
    })
    parts.push(`Equipe:\n${profs.join('\n')}`)
  }

  if (config?.contextoOperacional)
    parts.push(`Contexto operacional adicional:\n${config.contextoOperacional}`)

  return parts.join('\n\n')
}

export async function configRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/config
  app.get('/', { preHandler }, async (request: any, reply) => {
    const config = await prisma.configBot.findUnique({
      where: { empresaId: request.empresaId },
    })
    if (!config) return reply.code(404).send({ error: 'Config não encontrada' })
    return config
  })

  // PUT /app/config
  app.put('/', { preHandler }, async (request: any, reply) => {
    const body = configBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const config = await prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: {
        empresaId: request.empresaId,
        prompt: body.data.prompt ?? '',
        ...body.data,
      },
      update: body.data,
    })
    return config
  })

  // PATCH /app/config/bot-ativo
  app.patch('/bot-ativo', { preHandler }, async (request: any, reply) => {
    const body = z.object({ botAtivo: z.boolean() }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const config = await prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', botAtivo: body.data.botAtivo },
      update: { botAtivo: body.data.botAtivo },
      select: { botAtivo: true },
    })
    return config
  })

  // PATCH /app/config/idioma
  app.patch('/idioma', { preHandler }, async (request: any, reply) => {
    const body = z.object({ idioma: z.string().min(2) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', idioma: body.data.idioma, promptAtualizado: false },
      update: { idioma: body.data.idioma, promptAtualizado: false },
      select: { idioma: true, promptAtualizado: true },
    })
  })

  // PATCH /app/config/tipo-negocio
  app.patch('/tipo-negocio', { preHandler }, async (request: any, reply) => {
    const body = z.object({ tipoNegocio: z.string().min(1) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', tipoNegocio: body.data.tipoNegocio, promptAtualizado: false },
      update: { tipoNegocio: body.data.tipoNegocio, promptAtualizado: false },
      select: { tipoNegocio: true, promptAtualizado: true },
    })
  })

  // PATCH /app/config/contexto-operacional
  app.patch('/contexto-operacional', { preHandler }, async (request: any, reply) => {
    const body = z.object({ contexto: z.string().min(1) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', contextoOperacional: body.data.contexto, promptAtualizado: false },
      update: { contextoOperacional: body.data.contexto, promptAtualizado: false },
      select: { contextoOperacional: true, promptAtualizado: true },
    })
  })

  // POST /app/config/melhorar-contexto
  app.post('/melhorar-contexto', { preHandler }, async (request: any, reply) => {
    const config = await prisma.configBot.findUnique({
      where: { empresaId: request.empresaId },
      select: { contextoOperacional: true, tipoNegocio: true, idioma: true },
    })
    if (!config?.contextoOperacional) {
      return reply.code(422).send({ error: 'Nenhum contexto para melhorar' })
    }
    const idioma = config.idioma ?? 'pt-BR'
    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `You are an expert in configuring AI assistants for businesses. Rewrite the operational context in a clear, professional and detailed way, to be used as an instruction for an AI assistant via WhatsApp. Business type: ${config.tipoNegocio ?? 'not informed'}. IMPORTANT: respond ONLY in the language "${idioma}". Return ONLY the rewritten text, without titles, labels, prefixes or explanations. Do NOT mention communication tone, style or way of speaking — that is configured separately.` },
        { role: 'user', content: config.contextoOperacional },
      ],
    })
    return { contexto: completion.choices[0]?.message?.content ?? '' }
  })

  // PATCH /app/config/tom
  app.patch('/tom', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      tom: z.enum(['FORMAL', 'INFORMAL']).optional(),
      tomDisplay: z.string().min(1).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    const data: any = { promptAtualizado: false }
    if (body.data.tom) data.tom = body.data.tom
    if (body.data.tomDisplay !== undefined) data.tomDisplay = body.data.tomDisplay
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', ...data },
      update: data,
      select: { tom: true, tomDisplay: true, promptAtualizado: true },
    })
  })

  // PATCH /app/config/nome-assistente
  app.patch('/nome-assistente', { preHandler }, async (request: any, reply) => {
    const body = z.object({ nomeAssistente: z.string().min(1).max(50) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', nomeAssistente: body.data.nomeAssistente, promptAtualizado: false },
      update: { nomeAssistente: body.data.nomeAssistente, promptAtualizado: false },
      select: { nomeAssistente: true, promptAtualizado: true },
    })
  })

  // PATCH /app/config/genero-assistente
  app.patch('/genero-assistente', { preHandler }, async (request: any, reply) => {
    const body = z.object({ generoAssistente: z.enum(['masculino', 'feminino', 'neutro']) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', generoAssistente: body.data.generoAssistente, promptAtualizado: false },
      update: { generoAssistente: body.data.generoAssistente, promptAtualizado: false },
      select: { generoAssistente: true, promptAtualizado: true },
    })
  })

  // PATCH /app/config/identidade
  app.patch('/identidade', { preHandler }, async (request: any, reply) => {
    const body = z.object({ identidade: z.enum(['assistente_virtual', 'atendente_humano']) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', identidade: body.data.identidade, promptAtualizado: false },
      update: { identidade: body.data.identidade, promptAtualizado: false },
      select: { identidade: true, promptAtualizado: true },
    })
  })

  // PATCH /app/config/disponibilidade-ia
  app.patch('/disponibilidade-ia', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      disponibilidade: z.enum(['horario_comercial', '24_7', 'personalizado']),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', disponibilidade: body.data.disponibilidade },
      update: { disponibilidade: body.data.disponibilidade },
      select: { disponibilidade: true },
    })
  })

  // PATCH /app/config/horario-comercial
  app.patch('/horario-comercial', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      horarioInicio: z.string().regex(/^\d{2}:\d{2}$/),
      horarioFim: z.string().regex(/^\d{2}:\d{2}$/),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', horarioInicio: body.data.horarioInicio, horarioFim: body.data.horarioFim, promptAtualizado: false },
      update: { horarioInicio: body.data.horarioInicio, horarioFim: body.data.horarioFim, promptAtualizado: false },
      select: { horarioInicio: true, horarioFim: true, promptAtualizado: true },
    })
  })

  // PATCH /app/config/comandos-controle
  app.patch('/comandos-controle', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      palavraPausa: z.string().min(1).optional(),
      palavraRetorno: z.string().min(1).optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', ...body.data },
      update: body.data,
      select: { palavraPausa: true, palavraRetorno: true },
    })
  })

  // PATCH /app/config/auto-retomada
  app.patch('/auto-retomada', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      tempoRetornoMin: z.number().int().positive().nullable(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', tempoRetornoMin: body.data.tempoRetornoMin },
      update: { tempoRetornoMin: body.data.tempoRetornoMin },
      select: { tempoRetornoMin: true },
    })
  })

  // PATCH /app/config/confirmacao-antecedencia
  app.patch('/confirmacao-antecedencia', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      confirmacaoAntecedenciaHoras: z.number().int().min(1).max(48),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', confirmacaoAntecedenciaHoras: body.data.confirmacaoAntecedenciaHoras },
      update: { confirmacaoAntecedenciaHoras: body.data.confirmacaoAntecedenciaHoras },
      select: { confirmacaoAntecedenciaHoras: true },
    })
  })

  // PATCH /app/config/coleta-dados
  app.patch('/coleta-dados', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      coletarCadastroCompleto: z.boolean().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', ...body.data, promptAtualizado: false },
      update: { ...body.data, promptAtualizado: false },
      select: { coletarCadastroCompleto: true, promptAtualizado: true },
    })
  })

  // PATCH /app/config/prompt-confirmado — marca prompt como atualizado após regeneração
  app.patch('/prompt-confirmado', { preHandler }, async (request: any, _reply) => {
    return prisma.configBot.upsert({
      where: { empresaId: request.empresaId },
      create: { empresaId: request.empresaId, prompt: '', promptAtualizado: true },
      update: { promptAtualizado: true },
      select: { promptAtualizado: true },
    })
  })

  // POST /app/config/gerar-prompt
  app.post('/gerar-prompt', { preHandler }, async (request: any, reply) => {
    const config = await prisma.configBot.findUnique({
      where: { empresaId: request.empresaId },
    })
    if (!config) return reply.code(404).send({ error: 'Config não encontrada' })

    const contexto = await buildPromptContext(request.empresaId)
    const idioma = config.idioma ?? 'pt-BR'

    const genero = config.generoAssistente ?? 'neutro'
    const pronomeArtigo = genero === 'feminino' ? 'a' : genero === 'masculino' ? 'o' : ''
    const pronomeRef = genero === 'feminino' ? 'ela' : genero === 'masculino' ? 'ele' : 'você'
    const pronomeAdj = genero === 'feminino' ? 'bem-disposta, educada e atenciosa' : genero === 'masculino' ? 'bem-disposto, educado e atencioso' : 'bem-disposto(a), educado(a) e atencioso(a)'

    const identidadeInstrucao = config.identidade === 'atendente_humano'
      ? `Você se apresenta como ${pronomeArtigo ? pronomeArtigo + ' ' : ''}atendente ${config.nomeAssistente}. Nunca mencione que é uma IA ou assistente virtual. Comporte-se como ${pronomeRef} seria: ${pronomeAdj}.`
      : `Você é ${pronomeArtigo ? pronomeArtigo + ' ' : ''}assistente virtual chamado(a) ${config.nomeAssistente}.`

    const tomInstrucao = config.tomDisplay
      ? `Tom de comunicação: ${config.tomDisplay}.`
      : config.tom === 'INFORMAL'
      ? 'Tom de comunicação: informal e próximo.'
      : 'Tom de comunicação: profissional e cordial.'

    const tipo = (config.tipoNegocio ?? '').toLowerCase()
    const isClinica = /clinic|saude|medic|odonto|fisio|nutri|psico|farmac/.test(tipo)
    const isSalao = /salon|salao|estetica|beleza|spa|nail|barber|manicure/.test(tipo)

    let camposCompletos = ''
    if (config.coletarCadastroCompleto) {
      if (isClinica) {
        camposCompletos = ', e-mail, data de nascimento, convênio (plano de saúde), número da carteirinha e alergias ou medicações em uso'
      } else if (isSalao) {
        camposCompletos = ', e-mail, data de nascimento e preferências (tipo de cabelo, procedimentos anteriores, pele sensível)'
      } else {
        camposCompletos = ', e-mail e data de nascimento'
      }
    }

    const coletaInstrucao = `Ao atender um cliente pela primeira vez, colete durante a conversa de forma natural: nome completo e WhatsApp${camposCompletos}. Não faça todas as perguntas de uma vez — colete progressivamente ao longo da conversa.`

    const horasConf = config.confirmacaoAntecedenciaHoras ?? 24
    const confirmacaoInstrucao = `${horasConf} horas antes de cada agendamento o sistema envia automaticamente uma mensagem pedindo confirmação de presença. Quando o cliente responder:
- Confirmação (sim, confirmo, estarei lá, pode ser, ok): agradeça e confirme o horário com cordialidade
- Cancelamento (não, cancelar, não posso, não vou): pergunte gentilmente se deseja remarcar e ofereça ajuda para encontrar outro horário disponível
- Dúvida ou resposta vaga: esclareça o horário e reforce a importância da confirmação`

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é especialista em criar prompts para assistentes de IA no WhatsApp focados em agendamento.
Crie um prompt de sistema completo e profissional usando EXATAMENTE as informações fornecidas pelo usuário.

Regras obrigatórias:
- Use as informações de identidade, tom e dados da equipe exatamente como fornecidas
- NÃO inclua instruções para "confirmar identidade" (CPF/RG) — o sistema de CRM não coleta isso
- NÃO inclua "verificar disponibilidade no sistema" diretamente — o assistente aciona uma agente de agenda separada
- NÃO inclua "encaminhe para equipe humana" — o mecanismo ainda não existe; substitua por "informe que vai verificar e retorna em breve"
- Para preços, horários específicos e serviços detalhados, instrua a consultar o FAQ
- Responda APENAS em ${idioma}
- Retorne APENAS o prompt, sem explicações adicionais`,
        },
        {
          role: 'user',
          content: `Gere o prompt do assistente com base nestas configurações:

IDENTIDADE: ${identidadeInstrucao}
TOM: ${tomInstrucao}
COLETA DE DADOS NO CRM: ${coletaInstrucao}
CONFIRMAÇÃO DE AGENDAMENTOS: ${confirmacaoInstrucao}

DADOS DO NEGÓCIO:
${contexto}`,
        },
      ],
    })

    const prompt = completion.choices[0]?.message?.content ?? ''
    return { prompt }
  })
}
