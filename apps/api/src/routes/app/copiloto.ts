import type { FastifyInstance } from 'fastify'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

interface Gap {
  campo: string
  descricao: string
  prioridade: 'alta' | 'media' | 'baixa'
}

async function calcularScore(empresaId: string): Promise<{ score: number; gaps: Gap[] }> {
  const [config, profissionais, faqEntries, keywords, instancia] = await Promise.all([
    prisma.configBot.findUnique({ where: { empresaId } }),
    prisma.profissional.count({ where: { empresaId, ativo: true } }),
    prisma.faqEntry.count({ where: { empresaId } }),
    prisma.keyword.count({ where: { empresaId } }),
    prisma.instanciaWhatsApp.findUnique({ where: { empresaId }, select: { status: true } }),
  ])

  const gaps: Gap[] = []
  let pontos = 0
  const total = 100

  // Prompt configurado (20 pts)
  if (config?.prompt && config.prompt.length > 50) {
    pontos += 20
  } else {
    gaps.push({ campo: 'prompt', descricao: 'Prompt do assistente não configurado ou muito curto', prioridade: 'alta' })
  }

  // Tipo de negócio (10 pts)
  if (config?.tipoNegocio) {
    pontos += 10
  } else {
    gaps.push({ campo: 'tipo_negocio', descricao: 'Tipo de negócio não informado', prioridade: 'alta' })
  }

  // Contexto operacional (10 pts)
  if (config?.contextoOperacional && config.contextoOperacional.length > 30) {
    pontos += 10
  } else {
    gaps.push({ campo: 'contexto_operacional', descricao: 'Contexto operacional ausente ou muito curto', prioridade: 'alta' })
  }

  // WhatsApp conectado (20 pts)
  if (instancia?.status === 'CONNECTED') {
    pontos += 20
  } else {
    gaps.push({ campo: 'whatsapp', descricao: 'WhatsApp não está conectado', prioridade: 'alta' })
  }

  // Pelo menos 1 profissional (15 pts)
  if (profissionais > 0) {
    pontos += 15
  } else {
    gaps.push({ campo: 'profissionais', descricao: 'Nenhum profissional cadastrado', prioridade: 'alta' })
  }

  // FAQ com ao menos 3 entradas (10 pts)
  if (faqEntries >= 3) {
    pontos += 10
  } else {
    gaps.push({
      campo: 'faq',
      descricao: `FAQ com apenas ${faqEntries} entrada(s) — recomendado pelo menos 3`,
      prioridade: faqEntries === 0 ? 'media' : 'baixa',
    })
  }

  // Keywords (5 pts)
  if (keywords >= 3) {
    pontos += 5
  } else {
    gaps.push({ campo: 'keywords', descricao: 'Palavras-chave insuficientes (mínimo 3)', prioridade: 'baixa' })
  }

  // Horário comercial configurado (5 pts)
  if (config?.disponibilidade) {
    pontos += 5
  } else {
    gaps.push({ campo: 'disponibilidade', descricao: 'Disponibilidade da IA não configurada', prioridade: 'baixa' })
  }

  // Tom definido (5 pts)
  if (config?.tom) {
    pontos += 5
  } else {
    gaps.push({ campo: 'tom', descricao: 'Tom de voz não configurado', prioridade: 'baixa' })
  }

  return { score: Math.round((pontos / total) * 100), gaps }
}

export async function copilotoRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/copiloto/score
  app.get('/score', { preHandler }, async (request: any) => {
    const { score, gaps } = await calcularScore(request.empresaId)
    return { score, total_gaps: gaps.length }
  })

  // GET /app/copiloto/gaps
  app.get('/gaps', { preHandler }, async (request: any) => {
    const { score, gaps } = await calcularScore(request.empresaId)
    return { score, gaps }
  })

  // GET /app/copiloto/knowledge-gaps — perguntas sem resposta no FAQ
  app.get('/knowledge-gaps', { preHandler }, async (request: any) => {
    // Busca mensagens de leads que são perguntas sem correspondência no FAQ
    const [mensagens, faqEntries] = await Promise.all([
      prisma.mensagemConversa.findMany({
        where: {
          origem: 'LEAD',
          conversa: { empresaId: request.empresaId },
          conteudo: { contains: '?' },
        },
        select: { conteudo: true },
        orderBy: { criadoEm: 'desc' },
        take: 200,
      }),
      prisma.faqEntry.findMany({
        where: { empresaId: request.empresaId },
        select: { pergunta: true },
      }),
    ])

    // Filtra perguntas que não têm correspondência aproximada no FAQ
    const perguntasFaq = faqEntries.map(f => f.pergunta.toLowerCase())
    const semResposta = mensagens
      .map(m => m.conteudo.trim())
      .filter(p => {
        const palavrasChave = p.toLowerCase().replace(/[?!.,]/g, '').split(' ').filter(w => w.length > 3)
        return !perguntasFaq.some(fq => palavrasChave.some(w => fq.includes(w)))
      })
      .slice(0, 20)

    return { total: semResposta.length, perguntas: semResposta }
  })

  // POST /app/copiloto/faq/gerar — gera sugestões de FAQ das conversas reais
  app.post('/faq/gerar', { preHandler }, async (request: any, reply) => {
    const mensagens = await prisma.mensagemConversa.findMany({
      where: {
        origem: 'LEAD',
        conversa: { empresaId: request.empresaId },
        conteudo: { contains: '?' },
      },
      select: { conteudo: true, conversaId: true },
      orderBy: { criadoEm: 'desc' },
      take: 50,
    })

    if (mensagens.length === 0) {
      return reply.code(422).send({ error: 'Nenhuma pergunta encontrada nas conversas ainda' })
    }

    const perguntasUnicas = [...new Set(mensagens.map(m => m.conteudo.trim()))].slice(0, 15)

    const { default: OpenAI } = await import('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: `Analise as perguntas de clientes abaixo e gere sugestões de FAQ úteis.
Retorne um array JSON com objetos { "pergunta": string, "resposta": string }.
Agrupe perguntas similares em uma só. Máximo 8 sugestões. Retorne APENAS o JSON.`,
        },
        {
          role: 'user',
          content: perguntasUnicas.join('\n'),
        },
      ],
    })

    let sugestoes: Array<{ pergunta: string; resposta: string }> = []
    try {
      sugestoes = JSON.parse(completion.choices[0]?.message?.content ?? '[]')
    } catch {
      return reply.code(500).send({ error: 'Falha ao processar sugestões da IA' })
    }

    // Salva como faq_sugestoes pendentes
    const criadas = await prisma.$transaction(
      sugestoes.map(s =>
        prisma.faqSugestao.create({
          data: {
            empresaId: request.empresaId,
            pergunta: s.pergunta,
            respostaSugerida: s.resposta,
          },
        })
      )
    )

    return reply.code(201).send({ geradas: criadas.length, sugestoes: criadas })
  })
}
