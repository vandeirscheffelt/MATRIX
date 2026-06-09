/**
 * M17 — WhatsApp Integration
 *
 * Token da Evolution API movido para variável de ambiente server-side (GAP-SEC-01 fechado).
 * Frontend nunca vê o token — todas as chamadas passam por este proxy Fastify.
 *
 * Templates de notificação gerenciados via mastersaas.whatsapp_templates.
 * Envio de notificações acionado por eventos internos (webhook, CRON).
 */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { supabaseMasterSaaS } from '../../lib/supabase.js'
import { requireMSAuth, requireMSAdmin } from './auth-guard.js'

const EVOLUTION_URL = process.env.EVOLUTION_API_URL!
const EVOLUTION_KEY = process.env.EVOLUTION_API_KEY!

const TRIGGER_EVENTS = [
  'new_sale',
  'commission_available',
  'withdrawal_approved',
  'withdrawal_rejected',
  'welcome',
] as const

type TriggerEvent = typeof TRIGGER_EVENTS[number]

const templateBody = z.object({
  name:          z.string().min(1),
  body:          z.string().min(1),
  trigger_event: z.enum(TRIGGER_EVENTS),
  active:        z.boolean().default(true),
})

// ─── Serviço de envio de notificação ─────────────────────────────────────────

export async function sendWhatsAppNotification(
  phone:   string,
  message: string,
  log?:    any
): Promise<boolean> {
  if (!EVOLUTION_URL || !EVOLUTION_KEY) {
    log?.warn('WhatsApp: EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados')
    return false
  }

  // Sanitiza mensagem: ASCII only (Evolution API double-encodes acentos)
  const sanitized = message
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove diacríticos
    .replace(/[^\x20-\x7E]/g, '')     // remove não-ASCII

  try {
    const instance = process.env.MASTERSAAS_WHATSAPP_INSTANCE ?? 'mastersaas'
    const res = await fetch(`${EVOLUTION_URL}/message/sendText/${instance}`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':       EVOLUTION_KEY,
      },
      body: JSON.stringify({
        number:  phone.replace(/\D/g, ''), // apenas dígitos
        text:    sanitized,
      }),
    })

    if (!res.ok) {
      log?.error({ status: res.status, phone }, 'WhatsApp: erro ao enviar mensagem')
      return false
    }

    return true
  } catch (err) {
    log?.error({ err, phone }, 'WhatsApp: falha de rede ao enviar mensagem')
    return false
  }
}

/**
 * Preenche variáveis do template: {{1}}, {{2}}, ...
 * @param template "Ola {{1}}, sua comissao de R$ {{2}} foi liberada!"
 * @param vars     ["Joao", "150.00"]
 */
export function renderTemplate(template: string, vars: string[]): string {
  return vars.reduce(
    (text, val, i) => text.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val),
    template
  )
}

/**
 * Busca template ativo para o evento e envia a notificação.
 * Chamado pelos webhooks e pelo CRON após eventos relevantes.
 */
export async function notifyAffiliate(params: {
  phone:         string
  trigger_event: TriggerEvent
  vars:          string[]
  log?:          any
}): Promise<void> {
  const db = supabaseMasterSaaS()

  const { data: template } = await db
    .from('whatsapp_templates')
    .select('body')
    .eq('trigger_event', params.trigger_event)
    .eq('active', true)
    .single()

  if (!template) return // sem template configurado — silencioso

  const message = renderTemplate(template.body, params.vars)
  await sendWhatsAppNotification(params.phone, message, params.log)
}

// ─── Rotas ───────────────────────────────────────────────────────────────────

export async function msWhatsAppRoutes(app: FastifyInstance) {
  const db = supabaseMasterSaaS()
  const preHandler = [requireMSAuth, requireMSAdmin]

  // GET /mastersaas/admin/whatsapp/status — status da conexão WhatsApp
  app.get('/status', { preHandler }, async (_request, reply) => {
    if (!EVOLUTION_URL || !EVOLUTION_KEY) {
      return { status: 'not_configured', message: 'EVOLUTION_API_URL ou EVOLUTION_API_KEY ausentes' }
    }

    try {
      const instance = process.env.MASTERSAAS_WHATSAPP_INSTANCE ?? 'mastersaas'
      const res = await fetch(`${EVOLUTION_URL}/instance/connectionState/${instance}`, {
        headers: { apikey: EVOLUTION_KEY },
      })

      if (!res.ok) return { status: 'error', http_status: res.status }

      const data: any = await res.json()
      return {
        status:   data?.instance?.state ?? 'unknown',
        instance,
        raw:      data,
      }
    } catch (err) {
      return { status: 'error', message: (err as Error).message }
    }
  })

  // GET /mastersaas/admin/whatsapp/templates — lista templates
  app.get('/templates', { preHandler }, async (_request, reply) => {
    const { data, error } = await db
      .from('whatsapp_templates')
      .select('*')
      .order('trigger_event')

    if (error) return reply.code(500).send({ error: error.message })
    return { data }
  })

  // POST /mastersaas/admin/whatsapp/templates — cria template
  app.post('/templates', { preHandler }, async (request, reply) => {
    const body = templateBody.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await db
      .from('whatsapp_templates')
      .insert(body.data)
      .select()
      .single()

    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(201).send(data)
  })

  // PATCH /mastersaas/admin/whatsapp/templates/:id — atualiza template
  app.patch<{ Params: { id: string } }>('/templates/:id', { preHandler }, async (request, reply) => {
    const body = templateBody.partial().safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const { data, error } = await db
      .from('whatsapp_templates')
      .update({ ...body.data, updated_at: new Date().toISOString() })
      .eq('id', request.params.id)
      .select()
      .single()

    if (error || !data) return reply.code(404).send({ error: 'Template não encontrado' })
    return data
  })

  // DELETE /mastersaas/admin/whatsapp/templates/:id
  app.delete<{ Params: { id: string } }>('/templates/:id', { preHandler }, async (request, reply) => {
    const { error } = await db.from('whatsapp_templates').delete().eq('id', request.params.id)
    if (error) return reply.code(500).send({ error: error.message })
    return reply.code(204).send()
  })

  // POST /mastersaas/admin/whatsapp/test — envia mensagem de teste
  app.post('/test', { preHandler }, async (request, reply) => {
    const body = z.object({
      phone:   z.string().min(10),
      message: z.string().min(1),
    }).safeParse(request.body)

    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const sent = await sendWhatsAppNotification(body.data.phone, body.data.message, app.log)
    return { sent, phone: body.data.phone }
  })
}
