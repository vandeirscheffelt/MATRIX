import type { FastifyInstance } from 'fastify'
import { prisma } from '@boilerplate/database'
import { requireAuth, requireActiveSubscription } from '../../lib/auth.js'

const EVO_BASE_URL = process.env.EVOLUTION_API_URL!
const EVO_GLOBAL_KEY = process.env.EVOLUTION_API_KEY!

async function evoRequest(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${EVO_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': EVO_GLOBAL_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Evolution API error ${res.status}: ${text}`)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.json() as Promise<any>
}

export async function instanciaRoutes(app: FastifyInstance) {
  const preHandler = [requireAuth, requireActiveSubscription]

  // GET /app/instancia — status atual
  app.get('/', { preHandler }, async (request: any, reply) => {
    const instancia = await prisma.instanciaWhatsApp.findUnique({
      where: { empresaId: request.empresaId },
    })
    if (!instancia) return reply.code(404).send({ error: 'Nenhuma instância criada' })
    return instancia
  })

  // POST /app/instancia — cria instância na Evolution API
  app.post('/', { preHandler }, async (request: any, reply) => {
    const existing = await prisma.instanciaWhatsApp.findUnique({
      where: { empresaId: request.empresaId },
    })
    if (existing) return reply.code(409).send({ error: 'Instância já existe' })

    const nomeInstancia = `schaikron_${request.empresaId.replace(/-/g, '').slice(0, 16)}`

    const evoData = await evoRequest('/instance/create', 'POST', {
      instanceName: nomeInstancia,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    })

    const instancia = await prisma.instanciaWhatsApp.create({
      data: {
        empresaId: request.empresaId,
        nomeInstancia,
        token: evoData.hash?.apikey ?? '',
        status: 'CONNECTING',
        qrCodeBase64: evoData.qrcode?.base64 ?? null,
        qrExpiresAt: new Date(Date.now() + 60_000), // 60s
      },
    })

    return instancia
  })

  // GET /app/instancia/qr — atualiza e retorna novo QR code
  app.get('/qr', { preHandler }, async (request: any, reply) => {
    const instancia = await prisma.instanciaWhatsApp.findUnique({
      where: { empresaId: request.empresaId },
    })
    if (!instancia) return reply.code(404).send({ error: 'Nenhuma instância criada' })

    const evoData = await evoRequest(`/instance/connect/${instancia.nomeInstancia}`)

    const updated = await prisma.instanciaWhatsApp.update({
      where: { empresaId: request.empresaId },
      data: {
        qrCodeBase64: evoData.base64 ?? null,
        qrExpiresAt: new Date(Date.now() + 60_000),
        status: 'CONNECTING',
      },
    })

    return { qrCodeBase64: updated.qrCodeBase64, qrExpiresAt: updated.qrExpiresAt }
  })

  // DELETE /app/instancia — desconecta e remove
  app.delete('/', { preHandler }, async (request: any, reply) => {
    const instancia = await prisma.instanciaWhatsApp.findUnique({
      where: { empresaId: request.empresaId },
    })
    if (!instancia) return reply.code(404).send({ error: 'Nenhuma instância encontrada' })

    await evoRequest(`/instance/delete/${instancia.nomeInstancia}`, 'DELETE').catch(() => {})

    await prisma.instanciaWhatsApp.delete({ where: { empresaId: request.empresaId } })

    return { success: true }
  })
}
