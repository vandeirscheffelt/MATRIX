import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const pacienteBody = z.object({
  nome: z.string().min(1),
  whatsapp: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional().nullable(),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  cpf: z.string().optional().nullable(),
  endereco: z.object({
    rua: z.string().optional(),
    numero: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    estado: z.string().optional(),
    cep: z.string().optional(),
  }).optional().nullable(),
  convenio: z.string().optional().nullable(),
  carteirinha: z.string().optional().nullable(),
  alergias: z.string().optional().nullable(),
  medicacoes: z.string().optional().nullable(),
  historicoMedico: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  origem: z.enum(['manual', 'whatsapp']).optional(),
})

export async function pacientesRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/pacientes — listagem com busca e paginação
  app.get('/', { preHandler }, async (request: any) => {
    const { q, page = '1', limit = '20' } = request.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = { empresaId: request.empresaId }
    if (q) {
      where.OR = [
        { nome: { contains: q, mode: 'insensitive' } },
        { telefone: { contains: q } },
        { whatsapp: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
        { cpf: { contains: q } },
      ]
    }

    const [total, pacientes] = await Promise.all([
      prisma.paciente.count({ where }),
      prisma.paciente.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip,
        take: Number(limit),
        select: {
          id: true, nome: true, whatsapp: true, telefone: true,
          email: true, dataNascimento: true, convenio: true, carteirinha: true, alergias: true,
          origem: true, criadoEm: true,
          agendamentos: {
            orderBy: { inicio: 'desc' },
            take: 1,
            select: { inicio: true, status: true, servicoNome: true },
          },
        },
      }),
    ])

    return { total, page: Number(page), limit: Number(limit), data: pacientes }
  })

  // GET /app/pacientes/:id
  app.get('/:id', { preHandler }, async (request: any, reply) => {
    const paciente = await prisma.paciente.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
      include: {
        agendamentos: {
          orderBy: { inicio: 'desc' },
          take: 20,
          select: {
            id: true, inicio: true, fim: true, status: true,
            servicoNome: true, profissional: { select: { nome: true } },
          },
        },
      },
    })
    if (!paciente) return reply.code(404).send({ error: 'Paciente não encontrado' })
    return paciente
  })

  // POST /app/pacientes
  app.post('/', { preHandler }, async (request: any, reply) => {
    request.log.info({ body: request.body, empresaId: request.empresaId }, 'paciente POST recebido')

    const body = pacienteBody.safeParse(request.body)
    if (!body.success) {
      request.log.warn({ errors: body.error.flatten() }, 'paciente validacao falhou')
      return reply.code(400).send({ error: body.error.flatten() })
    }

    const data: any = { empresaId: request.empresaId, ...body.data }
    if (body.data.dataNascimento) data.dataNascimento = new Date(body.data.dataNascimento)

    try {
      const result = await prisma.paciente.create({ data })
      return reply.code(201).send(result)
    } catch (err: any) {
      request.log.error({ err: err?.message, code: err?.code, meta: err?.meta, data }, 'paciente.create failed')
      return reply.code(500).send({ error: err?.message ?? 'db error', code: err?.code })
    }
  })

  // PUT /app/pacientes/:id
  app.put('/:id', { preHandler }, async (request: any, reply) => {
    const body = pacienteBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const existing = await prisma.paciente.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!existing) return reply.code(404).send({ error: 'Paciente não encontrado' })

    const data: any = { ...body.data }
    if (body.data.dataNascimento) data.dataNascimento = new Date(body.data.dataNascimento)

    return prisma.paciente.update({ where: { id: request.params.id }, data })
  })

  // DELETE /app/pacientes/:id
  app.delete('/:id', { preHandler }, async (request: any, reply) => {
    const existing = await prisma.paciente.findFirst({
      where: { id: request.params.id, empresaId: request.empresaId },
    })
    if (!existing) return reply.code(404).send({ error: 'Paciente não encontrado' })
    await prisma.paciente.delete({ where: { id: request.params.id } })
    return reply.code(204).send()
  })

  // POST /app/pacientes/upsert-por-whatsapp — usado pela IA01 via n8n
  // Aceita todos os campos que o prompt instrui a coletar (clínica, salão, genérico)
  app.post('/upsert-por-whatsapp', { preHandler }, async (request: any, reply) => {
    const body = z.object({
      whatsapp: z.string().min(1),
      nome: z.string().min(1),
      telefone: z.string().optional(),
      email: z.string().email().optional().nullable(),
      dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      // campos clínica
      convenio: z.string().optional().nullable(),
      carteirinha: z.string().optional().nullable(),
      alergias: z.string().optional().nullable(),
      medicacoes: z.string().optional().nullable(),
      // campos salão / genérico
      observacoes: z.string().optional().nullable(),
      lgpdAceitoEm: z.string().datetime().optional(),
    }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { whatsapp, nome, lgpdAceitoEm, dataNascimento, ...rest } = body.data

    const data: any = {
      nome,
      origem: 'whatsapp',
      ...rest,
      ...(dataNascimento ? { dataNascimento: new Date(dataNascimento) } : {}),
      ...(lgpdAceitoEm ? { lgpdAceitoEm: new Date(lgpdAceitoEm) } : {}),
    }

    // Remove campos undefined para não sobrescrever dados existentes com null
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k])

    const paciente = await prisma.paciente.upsert({
      where: { empresaId_whatsapp: { empresaId: request.empresaId, whatsapp } },
      create: { empresaId: request.empresaId, whatsapp, ...data },
      update: data,
    })
    return paciente
  })
}
