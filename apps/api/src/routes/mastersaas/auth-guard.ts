/**
 * Guards reutilizáveis para rotas MasterSaaS.
 * Injetam msUserId e msUserEmail no request após validar o JWT Supabase.
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAdmin } from '../../lib/supabase.js'

export async function requireMSAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = (request.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) return reply.code(401).send({ error: 'Token ausente' })

  const { data: { user }, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !user) return reply.code(401).send({ error: 'Token inválido' })

  ;(request as any).msUserId    = user.id
  ;(request as any).msUserEmail = user.email
}

export async function requireMSAdmin(request: FastifyRequest, reply: FastifyReply) {
  const adminEmails = (process.env.MASTERSAAS_ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!adminEmails.includes((request as any).msUserEmail)) {
    return reply.code(403).send({ error: 'Acesso restrito a administradores do MasterSaaS' })
  }
}
