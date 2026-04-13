import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import pino from 'pino'
import { campanhasRoutes } from './routes/campanhas.js'
import { configuracoesRoutes } from './routes/configuracoes.js'
import { lancamentosRoutes } from './routes/lancamentos.js'
import { iniciarCronMetricas } from './jobs/cron-metricas.js'

const log = pino({ name: 'meta-ads-manager' })

const app = Fastify({ logger: true })

await app.register(cors, { origin: true })
await app.register(helmet)

app.get('/health', () => ({ ok: true, service: 'meta-ads-manager' }))

await app.register(campanhasRoutes)
await app.register(configuracoesRoutes)
await app.register(lancamentosRoutes)

const PORT = Number(process.env.META_ADS_PORT ?? 3200)

await app.listen({ port: PORT, host: '0.0.0.0' })

iniciarCronMetricas()

log.info(`meta-ads-manager rodando na porta ${PORT}`)
