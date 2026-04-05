import type { FastifyRequest, FastifyReply } from 'fastify'

/**
 * Guard simples para rotas admin do Calo.
 * Usa API key via header X-Calo-Admin-Key.
 * Substitua por Supabase Auth JWT quando houver painel web.
 */
export async function requireCaloAdmin(request: FastifyRequest, reply: FastifyReply) {
  const key = request.headers['x-calo-admin-key']
  if (!key || key !== process.env.CALO_ADMIN_KEY) {
    return reply.code(401).send({ error: 'Não autorizado' })
  }
}
