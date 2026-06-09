import type { FastifyInstance } from 'fastify'
import { createHmac, timingSafeEqual } from 'crypto'
import { processAffiliateSale } from './commission-engine.js'

function validarHmac(payload: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(payload).digest('hex')
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function msAppMaxWebhookRoutes(app: FastifyInstance) {
  // POST /mastersaas/webhook/appmax
  // Recebe eventos do AppMax emitidos pelo Evolia após pagamento confirmado.
  //
  // Configurar no painel AppMax:
  //   Webhook URL: https://api.shaikron.scheffelt.xyz/mastersaas/webhook/appmax
  //
  // O Evolia deve incluir no campo "custom_field" ou "metadata" do pedido:
  //   affiliate_code → código do afiliado
  //   product_code   → código do produto
  //   src            → string src completa
  //   phone          → telefone do comprador capturado pelo LIADS

  app.post('/', { config: { rawBody: true } }, async (request: any, reply) => {
    const secret    = process.env.APPMAX_WEBHOOK_SECRET_MASTERSAAS
    const signature = (request.headers['x-appmax-signature'] ?? '') as string

    // Valida HMAC se secret estiver configurado
    if (secret && signature) {
      const rawBody = request.rawBody?.toString() ?? ''
      if (!validarHmac(rawBody, signature, secret)) {
        return reply.code(401).send({ error: 'Assinatura AppMax inválida' })
      }
    }

    const event     = request.body as any
    const eventType = event?.event ?? ''
    const data      = event?.data ?? {}

    app.log.info({ eventType, order_id: data?.order_id }, 'appmax mastersaas: webhook recebido')

    switch (eventType) {
      case 'payment.approved':
      case 'order.paid': {
        // Extrai dados do pedido AppMax
        const orderId: string  = String(data?.order_id ?? data?.id ?? '')
        const email: string    = data?.customer?.email ?? data?.email ?? ''
        const phone: string    = data?.customer?.phone ?? data?.phone ?? ''
        const amountRaw        = data?.total_price ?? data?.amount ?? data?.value ?? 0
        const revenue: number  = typeof amountRaw === 'string'
          ? parseFloat(amountRaw)
          : Number(amountRaw)
        const currency         = 'BRL' // AppMax opera apenas em BRL

        // Metadata customizada enviada pelo Evolia ao criar o pedido
        const meta = data?.metadata ?? data?.custom_fields ?? {}
        const src:             string | null = meta?.src ?? null
        const affiliateCode:   string | null = meta?.affiliate_code ?? null
        const productCode:     string | null = meta?.product_code ?? null

        if (!orderId || !email || revenue <= 0) {
          app.log.warn({ orderId, email, revenue }, 'appmax mastersaas: dados insuficientes — ignorando')
          break
        }

        try {
          const result = await processAffiliateSale({
            gateway:             'appmax',
            external_payment_id: orderId,
            customer_email:      email,
            phone:               phone || null,
            revenue,
            currency,
            source:              src,
            raw_affiliate_code:  affiliateCode,
            raw_product_code:    productCode,
          }, app.log)

          app.log.info({ result, order_id: orderId }, 'appmax mastersaas: pagamento processado')
        } catch (err) {
          app.log.error({ err, order_id: orderId }, 'appmax mastersaas: erro ao processar pagamento')
          return reply.code(500).send({ error: 'Erro interno ao processar pagamento' })
        }
        break
      }

      case 'payment.refunded':
      case 'order.refunded': {
        const orderId = String(data?.order_id ?? data?.id ?? '')
        if (!orderId) break

        const { supabaseMasterSaaS } = await import('../../lib/supabase.js')
        const db = supabaseMasterSaaS()

        await db
          .from('sales')
          .update({ status: 'refunded' })
          .eq('gateway', 'appmax')
          .eq('external_payment_id', orderId)

        app.log.info({ order_id: orderId }, 'appmax mastersaas: reembolso — sale marcada como refunded')
        break
      }
    }

    return { received: true }
  })
}
