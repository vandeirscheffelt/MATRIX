import type { Coordinates } from './geocode'

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Fórmula Haversine — distância em linha reta entre dois pontos.
 * Multiplica por fator de rota para aproximar distância real por estrada.
 */
export function haversineKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2

  const straightLine = 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))

  // Fator 1.3 compensa tortuosidade de rotas reais (padrão da indústria)
  return straightLine * 1.3
}
