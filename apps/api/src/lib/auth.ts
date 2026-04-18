import type { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { prisma } from '@boilerplate/database'

function supabaseServiceRole() {
  return createClient(
    (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Valida JWT e injeta userId + empresaId no request
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = (request.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) return reply.code(401).send({ error: 'Token ausente' })

  const supabase = supabaseServiceRole()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return reply.code(401).send({ error: 'Token inválido' })

  const usuario = await prisma.usuario.findUnique({
    where: { id: user.id },
    select: { id: true, empresaId: true, role: true },
  })

  if (!usuario) return reply.code(403).send({ error: 'Usuário não vinculado a nenhuma empresa' })

  ;(request as any).userId = usuario.id
  ;(request as any).empresaId = usuario.empresaId
  ;(request as any).role = usuario.role
}

// Bloqueia se não for ADMIN_GLOBAL
export async function requireAdminGlobal(request: FastifyRequest, reply: FastifyReply) {
  const role = (request as any).role
  if (role !== 'ADMIN_GLOBAL') {
    return reply.code(403).send({ error: 'Acesso restrito a administradores globais' })
  }
}

// Bloqueia se trial expirado e sem assinatura ativa
export async function requireActiveSubscription(request: FastifyRequest, reply: FastifyReply) {
  const empresaId = (request as any).empresaId as string

  const sub = await prisma.subscription.findUnique({ where: { empresaId } })
  if (!sub) return reply.code(402).send({ error: 'Sem plano ativo' })

  const now = new Date()

  if (sub.status === 'ACTIVE') return
  if (sub.status === 'TRIAL' && sub.trialEndsAt && sub.trialEndsAt > now) return

  return reply.code(402).send({ error: 'Trial expirado. Assine para continuar.' })
}
