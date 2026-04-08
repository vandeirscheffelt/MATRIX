/**
 * Backend Proxy — Fastify
 *
 * Recebe chamadas da extensão Chrome e processa via Claude API.
 *
 * Endpoints:
 *   GET  /health  — healthcheck
 *   POST /chat    — recebe prompt do Lovable → chama Claude → devolve resultado
 *
 * TODO: quando descobrirmos como o Lovable entrega a resposta ao frontend
 * (WebSocket? SSE?), implementar o "push" da resposta de volta para a página.
 */

import { resolve } from "path"
import { config as dotenv } from "dotenv"

// Lê o .env da raiz do monorepo (../../../../.env)
dotenv({ path: resolve(import.meta.dirname, "../../../../.env") })

import Fastify from "fastify"
import cors from "@fastify/cors"
import Anthropic from "@anthropic-ai/sdk"

const app = Fastify({ logger: true })
const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

await app.register(cors, {
  origin: true, // extensão Chrome não tem origem fixa
})

// ── Health ────────────────────────────────────────────────────────────────────

app.get("/health", async () => ({ ok: true }))

// ── Chat ──────────────────────────────────────────────────────────────────────

interface ChatBody {
  message: string
  aiMessageId: string
  rawBody: Record<string, unknown>
}

app.post<{ Body: ChatBody }>("/chat", async (req, reply) => {
  const { message, aiMessageId, rawBody } = req.body

  app.log.info({ aiMessageId, message }, "Chat interceptado")

  const response = await claude.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8096,
    system: [
      "You are Lovable, an expert AI full-stack engineer.",
      "You generate clean, working React + TypeScript + Tailwind code.",
      `The user is viewing page: ${rawBody.current_page ?? "/"}`,
      `Viewport: ${rawBody.current_viewport_width}x${rawBody.current_viewport_height}`,
    ].join("\n"),
    messages: [{ role: "user", content: message }],
  })

  const text = response.content[0].type === "text" ? response.content[0].text : ""

  app.log.info({ chars: text.length }, "Claude respondeu")

  // Retorna 202 + body vazio para manter o contrato do Lovable
  // A entrega da resposta ao frontend ainda precisa ser mapeada (WebSocket/SSE)
  // Por ora logamos a resposta para inspecionar o canal correto
  return reply.status(202).send({ ok: true, response: text })
})

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.LOVABLE_PROXY_PORT ?? 3333)
await app.listen({ port: PORT, host: "127.0.0.1" })
