import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const faqBody = z.object({
  pergunta: z.string().min(1),
  resposta: z.string().min(1),
})

export async function faqRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/faq
  app.get('/', { preHandler }, async (request: any) => {
    return prisma.faqEntry.findMany({
      where: { empresaId: request.empresaId },
      orderBy: { criadoEm: 'asc' },
    })
  })

  // POST /app/faq
  app.post('/', { preHandler }, async (request: any, reply) => {
    const body = faqBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    return reply.code(201).send(
      await prisma.faqEntry.create({
        data: { empresaId: request.empresaId, ...body.data },
      })
    )
  })

  // PATCH /app/faq/:id
  app.patch('/:id', { preHandler }, async (request: any, reply) => {
    const body = faqBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const exists = await prisma.faqEntry.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!exists) return reply.code(404).send({ error: 'FAQ não encontrado' })

    return prisma.faqEntry.update({ where: { id: request.params.id }, data: body.data })
  })

  // DELETE /app/faq/:id
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const exists = await prisma.faqEntry.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!exists) return reply.code(404).send({ error: 'FAQ não encontrado' })

    await prisma.faqEntry.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })

  // PUT /app/faq — replace all FAQs for this empresa
  app.put('/', { preHandler }, async (request: any, reply) => {
    const body = z.array(faqBody).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    await prisma.$transaction([
      prisma.faqEntry.deleteMany({ where: { empresaId: request.empresaId } }),
      ...body.data.map(faq =>
        prisma.faqEntry.create({ data: { empresaId: request.empresaId, ...faq } })
      ),
    ])
    return reply.code(204).send()
  })

  // POST /app/faq/melhorar — IA melhora FAQ ou pede esclarecimento se contexto insuficiente
  app.post('/melhorar', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      pergunta: z.string().min(1),
      resposta: z.string().min(1),
      contexto_adicional: z.string().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const [config, empresa, servicos, keywords] = await Promise.all([
      prisma.configBot.findUnique({
        where: { empresaId: request.empresaId },
        select: {
          tipoNegocio: true,
          contextoOperacional: true,
          prompt: true,
          nomeAssistente: true,
          tom: true,
          tomDisplay: true,
          idioma: true,
        },
      }),
      prisma.empresa.findUnique({ where: { id: request.empresaId }, select: { nome: true } }),
      prisma.servico.findMany({ where: { empresaId: request.empresaId, ativo: true }, select: { nome: true, duracaoMin: true } }),
      prisma.keyword.findMany({ where: { empresaId: request.empresaId }, select: { palavra: true } }),
    ])

    const idioma = config?.idioma ?? 'pt-BR'
    const TOM_MAPEAMENTO: Record<string, string> = {
      'Professional': 'profissional e cordial — linguagem formal, objetiva, sem gírias',
      'Friendly': 'amigável e próximo — linguagem descontraída, calorosa, usa emojis com moderação',
      'Casual': 'casual e informal — linguagem bem leve, como conversa entre amigos, uso natural de gírias',
      'Formal': 'formal e reservado — linguagem culta, tratamento "senhor/senhora", sem informalidades',
      'Empathetic': 'empático e acolhedor — demonstra compreensão genuína, valida sentimentos do cliente, linguagem cuidadosa e humana',
      'Energetic': 'energético e entusiasmado — linguagem animada, proativa, usa pontuação expressiva (!), transmite energia positiva e motivação',
    }
    const rawTom = config?.tomDisplay ?? (config?.tom === 'FORMAL' ? 'Professional' : 'Friendly')
    const tom = TOM_MAPEAMENTO[rawTom] ?? rawTom

    // Usa o prompt completo se já gerado — é a fonte mais rica. Caso contrário, usa o contexto operacional.
    const contextoEmpresa = config?.prompt
      ? `[PROMPT DO ASSISTENTE]\n${config.prompt}`
      : config?.contextoOperacional
        ? `[CONTEXTO OPERACIONAL]\n${config.contextoOperacional}`
        : null

    const servicosStr = servicos.length > 0
      ? servicos.map(s => `${s.nome}${s.duracaoMin ? ` (${s.duracaoMin}min)` : ''}`).join(', ')
      : null
    const keywordsStr = keywords.length > 0 ? keywords.map(k => k.palavra).join(', ') : null

    const contextoParts = [
      `Empresa: ${empresa?.nome ?? 'não informado'}`,
      `Tipo de negócio: ${config?.tipoNegocio ?? 'não informado'}`,
      `Assistente: ${config?.nomeAssistente ?? 'não informado'}`,
      `Tom de resposta: ${tom}`,
      contextoEmpresa ?? 'Contexto operacional: ainda não gerado',
      servicosStr ? `Serviços: ${servicosStr}` : null,
      keywordsStr ? `Termos preferenciais: ${keywordsStr}` : null,
    ].filter(Boolean).join('\n')

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const userContent = [
      `Pergunta: ${body.data.pergunta}`,
      `Resposta atual: ${body.data.resposta}`,
      body.data.contexto_adicional ? `Contexto adicional do usuário: ${body.data.contexto_adicional}` : null,
    ].filter(Boolean).join('\n')

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `Você melhora perguntas e respostas do FAQ de um assistente de WhatsApp.
Responda SEMPRE no idioma: ${idioma}.

CONTEXTO DA EMPRESA:
${contextoParts}

REGRAS OBRIGATÓRIAS:
- O cliente já está numa conversa de WhatsApp — NUNCA sugira "entre em contato" ou "nos chame"
- A resposta deve ser direta e concisa: máximo 2 frases curtas ou 40 palavras
- Use o tom informado (${tom}) na resposta
- Se houver termos preferenciais, use-os naturalmente

REGRA PRINCIPAL — SEMPRE GERE A SUGESTÃO:
- Se a resposta contiver um número, assuma que é o valor correto (preço, duração, quantidade) e gere a sugestão usando esse valor
- Se o contexto adicional foi fornecido, use-o imediatamente para gerar a sugestão
- Em caso de dúvida sobre detalhes secundários, faça a escolha mais razoável e gere a sugestão assim mesmo
- Só peça esclarecimento se for COMPLETAMENTE impossível gerar qualquer resposta útil — situação rara

QUANDO GERAR SUGESTÃO retorne APENAS este JSON:
{"needs_clarification": false, "pergunta": "...", "resposta": "..."}

QUANDO PEDIR ESCLARECIMENTO (raramente) retorne APENAS este JSON:
{"needs_clarification": true, "question": "sua pergunta aqui"}`,
        },
        { role: 'user', content: userContent },
      ],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    if (result.needs_clarification) {
      return { needs_clarification: true, question: result.question ?? 'Pode fornecer mais detalhes sobre esta resposta?' }
    }

    return {
      needs_clarification: false,
      pergunta: result.pergunta ?? body.data.pergunta,
      resposta: result.resposta ?? body.data.resposta,
    }
  })

  // GET /app/faq/sugestoes
  app.get('/sugestoes', { preHandler }, async (request: any) => {
    return prisma.faqSugestao.findMany({
      where: { empresaId: request.empresaId, status: 'pendente' },
      orderBy: { criadoEm: 'desc' },
    })
  })

  // POST /app/faq/sugestoes/:id/aprovar — vira FAQ entry
  app.post('/sugestoes/:id/aprovar', { preHandler }, async (request: any, reply) => {
    const sugestao = await prisma.faqSugestao.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId, status: 'pendente' },
    })
    if (!sugestao) return reply.code(404).send({ error: 'Sugestão não encontrada' })

    const [entry] = await prisma.$transaction([
      prisma.faqEntry.create({
        data: {
          empresaId: request.empresaId,
          pergunta: sugestao.pergunta,
          resposta: sugestao.respostaSugerida,
          origem: 'sugestao_ia',
        },
      }),
      prisma.faqSugestao.update({
        where: { id: sugestao.id },
        data: { status: 'aprovada' },
      }),
    ])

    return reply.code(201).send(entry)
  })

  // POST /app/faq/sugestoes/:id/rejeitar
  app.post('/sugestoes/:id/rejeitar', { preHandler }, async (request: any, reply) => {
    const sugestao = await prisma.faqSugestao.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId, status: 'pendente' },
    })
    if (!sugestao) return reply.code(404).send({ error: 'Sugestão não encontrada' })

    return prisma.faqSugestao.update({
      where: { id: sugestao.id },
      data: { status: 'rejeitada' },
    })
  })
}
