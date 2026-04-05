import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { empresaRoutes } from './routes/app/empresa.js'
import { subscriptionRoutes } from './routes/app/subscription.js'
import { configRoutes } from './routes/app/config.js'
import { instanciaRoutes } from './routes/app/instancia.js'
import { gerenteRoutes } from './routes/app/gerente.js'
import { profissionaisRoutes } from './routes/app/profissionais.js'
import { agendamentosRoutes } from './routes/app/agendamentos.js'
import { leadsRoutes } from './routes/app/leads.js'
import { n8nWebhookRoutes } from './routes/webhook/n8n.js'

const app = Fastify({ logger: true })

await app.register(helmet)
await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })
await app.register(cors, {
  origin: process.env.WEB_URL ?? 'http://localhost:3000',
  credentials: true,
})
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

// Auth
await app.register(authRoutes, { prefix: '/auth' })
await app.register(healthRoutes)

// App — requer auth + subscription guard (aplicado dentro de cada rota)
await app.register(empresaRoutes, { prefix: '/app/empresa' })
await app.register(subscriptionRoutes, { prefix: '/app/subscription' })
await app.register(configRoutes, { prefix: '/app/config' })
await app.register(instanciaRoutes, { prefix: '/app/instancia' })
await app.register(gerenteRoutes, { prefix: '/app/gerente' })
await app.register(profissionaisRoutes, { prefix: '/app/profissionais' })
await app.register(agendamentosRoutes, { prefix: '/app/agendamentos' })
await app.register(leadsRoutes, { prefix: '/app/leads' })

// Webhooks n8n — autenticados por x-webhook-secret
await app.register(n8nWebhookRoutes, { prefix: '/webhook/n8n' })

// Calo — sistema de venda de calopsitas
const { birdsRoutes } = await import('./routes/calo/birds.js')
const { ordersRoutes } = await import('./routes/calo/orders.js')
const { ordersListRoutes } = await import('./routes/calo/orders-list.js')
const { buyersRoutes } = await import('./routes/calo/buyers.js')
const { breedersRoutes } = await import('./routes/calo/breeders.js')
const { parentsRoutes } = await import('./routes/calo/parents.js')
const { uploadsRoutes } = await import('./routes/calo/uploads.js')
const { caloWebhookRoutes } = await import('./routes/calo/webhook.js')
const { requireCaloAdmin } = await import('./lib/calo-auth.js')

// Rotas públicas (leitura do catálogo + criação de pedido)
await app.register(birdsRoutes, { prefix: '/calo/birds' })
await app.register(ordersRoutes, { prefix: '/calo/orders' })

// Rotas admin — requerem X-Calo-Admin-Key
await app.register(async (admin) => {
  admin.addHook('preHandler', requireCaloAdmin)
  await admin.register(ordersListRoutes, { prefix: '/calo/admin/orders' })
  await admin.register(buyersRoutes,     { prefix: '/calo/admin/buyers' })
  await admin.register(breedersRoutes,   { prefix: '/calo/admin/breeders' })
  await admin.register(parentsRoutes,    { prefix: '/calo/admin/parents' })
  await admin.register(uploadsRoutes,    { prefix: '/calo/admin/uploads' })
})

await app.register(caloWebhookRoutes, { prefix: '/webhook/stripe/calo' })

const port = Number(process.env.PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
