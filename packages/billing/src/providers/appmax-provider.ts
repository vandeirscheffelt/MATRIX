import type { IPaymentGateway, GatewayCheckoutParams, GatewayPortalParams, GatewayCheckoutResult } from '../gateway-interface'

const APPMAX_BASE = 'https://api.appmax.com.br/api/v3'

function getKey(): string {
  const key = process.env.APPMAX_API_KEY
  if (!key) throw new Error('APPMAX_API_KEY não configurada')
  return key
}

async function appmaxPost(path: string, body: object): Promise<any> {
  const res = await fetch(`${APPMAX_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json() as any
  if (!res.ok) {
    throw new Error(`AppMax ${path} → ${res.status}: ${json?.message ?? JSON.stringify(json)}`)
  }
  return json
}

async function appmaxGet(path: string): Promise<any> {
  const res = await fetch(`${APPMAX_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getKey()}` },
  })
  const json = await res.json() as any
  if (!res.ok) {
    throw new Error(`AppMax ${path} → ${res.status}: ${json?.message ?? JSON.stringify(json)}`)
  }
  return json
}

async function garantirCliente(params: GatewayCheckoutParams): Promise<string> {
  // Tenta buscar cliente existente por email
  try {
    const res = await appmaxGet(`/customer?email=${encodeURIComponent(params.userEmail)}`)
    if (res?.data?.id) return String(res.data.id)
  } catch { /* não encontrado, cria */ }

  const customer = await appmaxPost('/customer', {
    name: params.userName ?? params.userEmail.split('@')[0],
    email: params.userEmail,
    document: params.userCpf ?? '',
    phone: params.userPhone ?? '',
  })
  return String(customer.data.id)
}

export class AppMaxProvider implements IPaymentGateway {
  async createCheckout(params: GatewayCheckoutParams): Promise<GatewayCheckoutResult> {
    const planId = process.env.APPMAX_PLAN_ID_SHAIKRON_BASE
    if (!planId) throw new Error('APPMAX_PLAN_ID_SHAIKRON_BASE não configurada')

    const customerId = await garantirCliente(params)

    if (params.paymentMethod === 'pix') {
      // Cria cobrança PIX avulsa para o primeiro mês, assinatura fica ativa após aprovação
      const charge = await appmaxPost('/charge/pix', {
        customer_id: customerId,
        amount: 9700, // R$ 97,00 em centavos
        description: 'Shaikron — Plano Base',
        metadata: { empresaId: params.empresaId, planId },
      })

      return {
        gateway: 'appmax',
        customerId,
        pix: {
          qrCode: charge.data.pix_qr_code,
          qrCodeBase64: charge.data.pix_qr_code_base64 ?? '',
          expiresAt: charge.data.expires_at,
          valor: 97.0,
        },
      }
    }

    if (params.paymentMethod === 'boleto') {
      const charge = await appmaxPost('/charge/boleto', {
        customer_id: customerId,
        amount: 9700,
        description: 'Shaikron — Plano Base',
        metadata: { empresaId: params.empresaId, planId },
      })

      return {
        gateway: 'appmax',
        customerId,
        boleto: {
          url: charge.data.boleto_url,
          barcode: charge.data.boleto_barcode,
          expiresAt: charge.data.expires_at,
        },
      }
    }

    // card_br — checkout hospedado no AppMax
    const sub = await appmaxPost('/subscription', {
      customer_id: customerId,
      plan_id: planId,
      payment_method: 'credit_card',
      redirect_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: { empresaId: params.empresaId },
    })

    return {
      url: sub.data.checkout_url,
      gateway: 'appmax',
      customerId,
      subscriptionId: String(sub.data.id),
    }
  }

  async createPortalSession(_params: GatewayPortalParams): Promise<{ url: string }> {
    // AppMax não tem portal de auto-serviço — redireciona para suporte interno
    const dashUrl = process.env.SHAIKRON_APP_URL ?? 'https://app.shaikron.scheffelt.xyz'
    return { url: `${dashUrl}/conta` }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    await appmaxPost(`/subscription/${subscriptionId}/cancel`, {})
  }
}
