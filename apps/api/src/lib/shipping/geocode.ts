import { z } from 'zod'

const NominatimResponseSchema = z.array(
  z.object({
    lat: z.string(),
    lon: z.string(),
    display_name: z.string(),
  })
)

export interface Coordinates {
  lat: number
  lng: number
}

export async function geocodeAddress(address: string): Promise<Coordinates> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', address)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'br')

  const res = await fetch(url.toString(), {
    headers: {
      // Nominatim exige User-Agent identificado
      'User-Agent': 'MatrixApp/1.0 (vandeir.professor@gmail.com)',
    },
  })

  if (!res.ok) {
    throw new Error(`Nominatim error: ${res.status}`)
  }

  const data = NominatimResponseSchema.parse(await res.json())

  if (data.length === 0) {
    throw new Error(`Endereço não encontrado: "${address}"`)
  }

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
  }
}
