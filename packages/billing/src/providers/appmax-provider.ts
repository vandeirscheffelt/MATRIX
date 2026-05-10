import type { IPaymentGateway, GatewayCheckoutParams, GatewayPortalParams, GatewayCheckoutResult } from '../gateway-interface'

const APPMAX_BASE = 'https://admin.appmax.com.br/api/v3'

function getKey(): string {
  const key = process.env.APPMAX_API_KEY
  if (!key) throw new Error('APPMAX_API_KEY não configurada')
  return key
}

async function appmaxPost(path: string, body: object): Promise<any> {
  const res = await fetch(`${APPMAX_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 'access-token': getKey(), ...body }),
  })
  const json = await res.json() as any
  if (json.success === false) {
    throw new Error(`AppMax ${path}: ${json.text ?? JSON.stringify(json.data)}`)
  }
  return json
}

async function garantirCliente(params: GatewayCheckoutParams): Promise<number> {
  // Tenta encontrar cliente existente por email
  const listRes = await fetch(
    `${APPMAX_BASE}/customer?access-token=${getKey()}&email=${encodeURIComponent(params.userEmail)}&limit=1`
  )
  const listJson = await listRes.json() as any
  const existing = listJson?.data?.data?.[0]
  if (existing?.id) return Number(existing.id)

  // Cria novo cliente
  const nameParts = (params.userName ?? params.userEmail.split('@')[0]).split(' ')
  const res = await appmaxPost('/customer', {
    firstname: nameParts[0] ?? 'Cliente',
    lastname: nameParts.slice(1).join(' ') || 'Shaikron',
    email: params.userEmail,
    telephone: params.userPhone?.replace(/\D/g, '') ?? '11000000000',
    ip: '127.0.0.1',
    document: params.userCpf?.replace(/\D/g, '') ?? '',
  })
  return Number(res.data?.id ?? res.id)
}

async function criarOrder(customerId: number): Promise<number> {
  const res = await appmaxPost('/order', {
    customer_id: customerId,
    digital_product: 1,
    products: [{
      sku: 'SHAIKRON-BASE-97',
      name: 'Shaikron - Plano Base',
      qty: 1,
      price: 97.00,
    }],
  })
  return Number(res.data?.id ?? res.id)
}

export class AppMaxProvider implements IPaymentGateway {
  async createCheckout(params: GatewayCheckoutParams): Promise<GatewayCheckoutResult> {
    const customerId = await garantirCliente(params)
    const orderId = await criarOrder(customerId)

    if (params.paymentMethod === 'pix') {
      const expiration = new Date(Date.now() + 30 * 60 * 1000) // 30 min
      const expirationStr = expiration.toISOString().replace('T', ' ').slice(0, 19)

      const res = await appmaxPost('/payment/pix', {
        cart: { order_id: orderId },
        customer: { customer_id: customerId },
        payment: {
          pix: {
            document_number: params.userCpf?.replace(/\D/g, '') ?? '00000000000',
            expiration_date: expirationStr,
          },
        },
      })

      return {
        gateway: 'appmax',
        customerId: String(customerId),
        subscriptionId: String(orderId),
        pix: {
          qrCode: res.data?.pix_qr_code ?? res.data?.qr_code ?? '',
          qrCodeBase64: res.data?.pix_qr_code_base64 ?? res.data?.qr_code_base64 ?? '',
          expiresAt: expiration.toISOString(),
          valor: 97.0,
        },
      }
    }

    if (params.paymentMethod === 'boleto') {
      const res = await appmaxPost('/payment/boleto', {
        cart: { order_id: orderId },
        customer: { customer_id: customerId },
        payment: {
          boleto: {
            document_number: params.userCpf?.replace(/\D/g, '') ?? '00000000000',
          },
        },
      })

      return {
        gateway: 'appmax',
        customerId: String(customerId),
        subscriptionId: String(orderId),
        boleto: {
          url: res.data?.boleto_url ?? res.data?.url ?? '',
          barcode: res.data?.boleto_barcode ?? res.data?.barcode ?? '',
          expiresAt: res.data?.expires_at ?? new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        },
      }
    }

    // card_br — checkout hospedado AppMax (redireciona para URL gerada pela AppMax)
    // Como a AppMax não tem checkout hospedado via API para card, usamos o link de pagamento do order
    const checkoutUrl = `https://pay.appmax.com.br/${orderId}`

    return {
      url: checkoutUrl,
      gateway: 'appmax',
      customerId: String(customerId),
      subscriptionId: String(orderId),
    }
  }

  async createPortalSession(_params: GatewayPortalParams): Promise<{ url: string }> {
    const dashUrl = process.env.SHAIKRON_APP_URL ?? 'https://app.shaikron.scheffelt.xyz'
    return { url: `${dashUrl}/conta` }
  }

  async cancelSubscription(orderId: string): Promise<void> {
    // AppMax não tem cancelamento de assinatura recorrente via API — registramos internamente
    // O controle de renovação é feito pelo nosso sistema (n8n + webhook)
    await appmaxPost('/order/cancel', { order_id: Number(orderId) }).catch(() => {})
  }
}
