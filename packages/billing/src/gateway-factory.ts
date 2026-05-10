import type { PaymentMethod, IPaymentGateway } from './gateway-interface.js'
import { AppMaxProvider } from './providers/appmax-provider.js'
import { StripeProvider } from './providers/stripe-provider.js'

export function getGateway(paymentMethod: PaymentMethod): IPaymentGateway {
  if (paymentMethod === 'card_intl') return new StripeProvider()
  return new AppMaxProvider()
}

export function getGatewayByName(name: string): IPaymentGateway {
  if (name === 'stripe') return new StripeProvider()
  return new AppMaxProvider()
}
