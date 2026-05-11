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
    // Loga detalhes de validação para debug
    if (json.data) console.log(`[AppMax ${path} validation]`, JSON.stringify(json.data))
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

async function criarOrder(customerId: number, usuariosExtras: number = 0, couponCode?: string, discountType?: 'percent' | 'fixed', discountValue?: number): Promise<number> {
  let basePrice = 97.00
  let extraUserPrice = 29.90
  
  if (discountType === 'percent' && discountValue) {
    basePrice = Number((basePrice * (1 - discountValue / 100)).toFixed(2))
    extraUserPrice = Number((extraUserPrice * (1 - discountValue / 100)).toFixed(2))
  } else if (discountType === 'fixed' && discountValue) {
    let remainingDiscount = discountValue
    if (remainingDiscount <= basePrice) {
      basePrice = Number((basePrice - remainingDiscount).toFixed(2))
    } else {
      remainingDiscount -= basePrice
      basePrice = 0
      if (usuariosExtras > 0) {
        const discountPerUser = remainingDiscount / usuariosExtras
        extraUserPrice = Number(Math.max(0, extraUserPrice - discountPerUser).toFixed(2))
      }
    }
  }

  const products: object[] = [{
    sku: 'SHAIKRON-BASE-97',
    name: 'Shaikron - Plano Base',
    qty: 1,
    price: basePrice,
  }]
  if (usuariosExtras > 0) {
    products.push({
      sku: 'SHAIKRON-USER-2990',
      name: 'Usuário adicional com IA',
      qty: usuariosExtras,
      price: extraUserPrice,
    })
  }
  const res = await appmaxPost('/order', {
    customer_id: customerId,
    digital_product: 1,
    products,
    ...(couponCode ? { coupon_code: couponCode } : {}),
  })
  return Number(res.data?.id ?? res.id)
}

export class AppMaxProvider implements IPaymentGateway {
  async createCheckout(params: GatewayCheckoutParams): Promise<GatewayCheckoutResult> {
    const customerId = await garantirCliente(params)
    const orderId = await criarOrder(
      customerId, 
      params.usuariosExtras ?? 0, 
      params.couponCode,
      params.discountType,
      params.discountValue
    )

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

      const pixData = res.data ?? res
      return {
        gateway: 'appmax',
        customerId: String(customerId),
        subscriptionId: String(orderId),
        pix: {
          qrCode: pixData?.pix_emv ?? '',
          qrCodeBase64: pixData?.pix_qrcode ?? '',
          expiresAt: pixData?.pix_expiration_date
            ? new Date(pixData.pix_expiration_date).toISOString()
            : expiration.toISOString(),
          valor: 97.0,
        },
      }
    }

    if (params.paymentMethod === 'boleto') {
      const dueDate = new Date(Date.now() + 3 * 24 * 3600 * 1000)
      const dueDateStr = dueDate.toISOString().slice(0, 10) // YYYY-MM-DD

      // AppMax exige "Boleto" com B maiúsculo no payload
      const boletoRes = await appmaxPost('/payment/boleto', {
        cart: { order_id: orderId },
        customer: { customer_id: customerId },
        payment: {
          Boleto: {
            document_number: params.userCpf?.replace(/\D/g, '') ?? '',
            due_date: dueDateStr,
          },
        },
      })

      console.log('[AppMax Boleto response]', JSON.stringify(boletoRes?.data ?? boletoRes, null, 2).slice(0, 500))

      const boletoData = boletoRes.data ?? boletoRes
      return {
        gateway: 'appmax',
        customerId: String(customerId),
        subscriptionId: String(orderId),
        boleto: {
          url: boletoData?.pdf ?? boletoData?.boleto_url ?? boletoData?.url ?? '',
          barcode: boletoData?.digitable_line ?? boletoData?.boleto_payment_code ?? boletoData?.barcode ?? '',
          expiresAt: boletoData?.due_date ?? dueDate.toISOString(),
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
