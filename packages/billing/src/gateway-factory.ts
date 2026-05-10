import type { PaymentMethod, IPaymentGateway } from './gateway-interface'
import { AppMaxProvider } from './providers/appmax-provider'
import { StripeProvider } from './providers/stripe-provider'

export function getGateway(paymentMethod: PaymentMethod): IPaymentGateway {
  if (paymentMethod === 'card_intl') return new StripeProvider()
  return new AppMaxProvider()
}

export function getGatewayByName(name: string): IPaymentGateway {
  if (name === 'stripe') return new StripeProvider()
  return new AppMaxProvider()
}
