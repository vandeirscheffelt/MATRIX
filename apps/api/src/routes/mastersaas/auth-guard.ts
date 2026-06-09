/**
 * Guards reutilizáveis para rotas MasterSaaS.
 *
 * O frontend Lovable usa um projeto Supabase próprio (MASTERSAAS_SUPABASE_URL).
 * A API principal usa SUPABASE_URL (projeto Shaikron).
 * O guard tenta validar o JWT em ambos, nessa ordem.
 */
import type { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../../lib/supabase.js'

function supabaseMasterSaaSAuth() {
  const url = process.env.MASTERSAAS_SUPABASE_URL
  const key = process.env.MASTERSAAS_SUPABASE_SERVICE_KEY ?? process.env.MASTERSAAS_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function requireMSAuth(request: FastifyRequest, reply: FastifyReply) {
  const token = (request.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) return reply.code(401).send({ error: 'Token ausente' })

  // 1) Tenta o Supabase do Lovable (projeto MasterSaaS frontend)
  const msClient = supabaseMasterSaaSAuth()
  if (msClient) {
    const { data: { user }, error } = await msClient.auth.getUser(token)
    if (!error && user) {
      ;(request as any).msUserId    = user.id
      ;(request as any).msUserEmail = user.email
      return
    }
  }

  // 2) Fallback: Supabase principal (Shaikron)
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
