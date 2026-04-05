import { geocodeAddress } from './geocode'
import { haversineKm } from './distance'

export interface ShippingConfig {
  /** Preço por km em reais (ex: 0.50) */
  pricePerKm: number
  /** Frete mínimo em reais (ex: 10.00) */
  minimumPrice: number
  /** Frete grátis acima deste valor de pedido em reais (0 = desativado) */
  freeShippingAbove?: number
}

export interface ShippingResult {
  distanceKm: number
  price: number
  isFree: boolean
}

const DEFAULT_CONFIG: ShippingConfig = {
  pricePerKm: parseFloat(process.env.PRICE_PER_KM ?? '0.5'),
  minimumPrice: parseFloat(process.env.MINIMUM_PRICE ?? '10'),
  freeShippingAbove: 0,
}

export async function calculateShipping(
  sellerAddress: string,
  customerAddress: string,
  orderTotal: number = 0,
  config: ShippingConfig = DEFAULT_CONFIG
): Promise<ShippingResult> {
  const [sellerCoords, customerCoords] = await Promise.all([
    geocodeAddress(sellerAddress),
    geocodeAddress(customerAddress),
  ])

  const distanceKm = haversineKm(sellerCoords, customerCoords)

  const isFree =
    config.freeShippingAbove != null &&
    config.freeShippingAbove > 0 &&
    orderTotal >= config.freeShippingAbove

  const rawPrice = distanceKm * config.pricePerKm
  const price = isFree ? 0 : Math.max(rawPrice, config.minimumPrice)

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    price: Math.round(price * 100) / 100,
    isFree,
  }
}
