import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@boilerplate/database'
import { requireAuth } from '../lib/auth.js'

function supabaseServiceRole() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nomeEmpresa: z.string().min(1),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
})

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/register — cria conta Supabase + empresa + trial
  app.post('/register', async (request, reply) => {
    const body = registerBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { email, password, nomeEmpresa, slug } = body.data

    const supabase = supabaseServiceRole()
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return reply.code(400).send({ error: authError?.message ?? 'Erro ao criar usuário' })
    }

    // Cria empresa + usuário + trial de 24h em transação
    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 dias

    await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: { nome: nomeEmpresa, slug },
      })

      await tx.usuario.create({
        data: { id: authData.user!.id, empresaId: empresa.id, role: 'ADMIN' },
      })

      await tx.subscription.create({
        data: { empresaId: empresa.id, status: 'TRIAL', trialEndsAt },
      })
    })

    return reply.code(201).send({ message: 'Conta criada. Trial de 24h ativo.' })
  })

  // GET /auth/me
  app.get('/me', { preHandler: requireAuth }, async (request: any) => {
    const usuario = await prisma.usuario.findUnique({
      where: { id: request.userId },
      include: {
        empresa: {
          include: { subscription: true },
        },
      },
    })
    return usuario
  })
}
