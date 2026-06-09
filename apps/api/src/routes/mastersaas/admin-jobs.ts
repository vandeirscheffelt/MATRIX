import type { FastifyInstance } from 'fastify'
import { supabaseAdmin, supabaseMasterSaaS } from '../../lib/supabase.js'

async function requireMasterSaaSAuth(request: any, reply: any) {
  const token = (request.headers.authorization ?? '').replace('Bearer ', '').trim()
  if (!token) return reply.code(401).send({ error: 'Token ausente' })
  const { data: { user }, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !user) return reply.code(401).send({ error: 'Token inválido' })
  request.msUserEmail = user.email
}

async function requireMasterSaaSAdmin(request: any, reply: any) {
  const adminEmails = (process.env.MASTERSAAS_ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!adminEmails.includes(request.msUserEmail)) {
    return reply.code(403).send({ error: 'Acesso restrito a administradores do MasterSaaS' })
  }
}

export async function msAdminJobsRoutes(app: FastifyInstance) {
  const preHandler = [requireMasterSaaSAuth, requireMasterSaaSAdmin]

  // POST /mastersaas/admin/jobs/release-commissions
  // Dispara manualmente a liberação de comissões (mesmo lógica do CRON diário)
  // Útil para testes e para corrigir atrasos em caso de falha do CRON
  app.post('/release-commissions', { preHandler }, async (_request, reply) => {
    const db = supabaseMasterSaaS()

    // Chama a função pg diretamente via rpc
    const { data, error } = await db.rpc('release_pending_commissions' as any)

    if (error) {
      app.log.error({ error }, 'mastersaas: erro ao executar release_pending_commissions')
      return reply.code(500).send({ error: error.message })
    }

    return data ?? { released_count: 0, released_amount: 0 }
  })

  // GET /mastersaas/admin/jobs/cron-status
  // Retorna status do job CRON e última execução
  app.get('/cron-status', { preHandler }, async (_request, reply) => {
    const adminDb = supabaseAdmin()

    const { data, error } = await adminDb
      .schema('cron' as any)
      .from('job' as any)
      .select('jobid, jobname, schedule, active, last_run:job_run_details(runid,status,start_time,end_time,return_message)')
      .eq('jobname', 'release-mastersaas-commissions')
      .single() as any

    if (error) return reply.code(500).send({ error: error.message })
    return data ?? { message: 'Job não encontrado — verifique se pg_cron está ativo' }
  })
}
