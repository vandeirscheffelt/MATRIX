import type { PaymentMethod, IPaymentGateway } from './gateway-interface'
import { AppMaxProvider } from './providers/appmax-provider'
import { StripeProvider } from './providers/stripe-provider'

export function getGateway(paymentMethod: PaymentMethod): IPaymentGateway {
  if (paymentMethod === 'pix' || paymentMethod === 'boleto') return new AppMaxProvider()
  return new StripeProvider() // card_br e card_intl → Stripe (cobrança automática mensal)
}

export function getGatewayByName(name: string): IPaymentGateway {
  if (name === 'stripe') return new StripeProvider()
  return new AppMaxProvider()
}
