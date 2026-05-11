export type PaymentMethod = 'pix' | 'boleto' | 'card_br' | 'card_intl'

export interface GatewayCheckoutParams {
  empresaId: string
  userId: string
  userEmail: string
  userName?: string
  userPhone?: string
  userCpf?: string
  usuariosExtras?: number
  paymentMethod: PaymentMethod
  successUrl: string
  cancelUrl: string
  trialDays?: number
  couponCode?: string   // código de cupom/promoção (Stripe: promotion_code; AppMax: coupon_code)
}

export interface GatewayPortalParams {
  empresaId: string
  customerId: string
  returnUrl: string
}

export interface GatewayCheckoutResult {
  url?: string
  pix?: {
    qrCode: string
    qrCodeBase64: string
    expiresAt: string
    valor: number
  }
  boleto?: {
    url: string
    barcode: string
    expiresAt: string
  }
  gateway: 'appmax' | 'stripe'
  customerId: string
  subscriptionId?: string
}

export interface IPaymentGateway {
  createCheckout(params: GatewayCheckoutParams): Promise<GatewayCheckoutResult>
  createPortalSession(params: GatewayPortalParams): Promise<{ url: string }>
  cancelSubscription(subscriptionId: string): Promise<void>
}
