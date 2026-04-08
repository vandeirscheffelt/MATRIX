// Plasmo: injeta no contexto principal da página (main world)
// Necessário para sobrescrever window.fetch que pertence à página
export const config = {
  matches: ["https://lovable.dev/*"],
  run_at: "document_start" as const,
  world: "MAIN" as const,
}

/**
 * Interceptor do Lovable
 *
 * Fluxo real descoberto por engenharia reversa:
 * 1. POST api.lovable.dev/projects/{id}/chat → 202 vazio (enfileira)
 * 2. GET firestore.googleapis.com/.../Listen/channel → long-poll com chunks
 *    Cada chunk: byte-length\n[[targetId,[{documentChange:{document:{fields:{content:{stringValue:"..."}}}}}]]]
 *    Caminho do documento: projects/{projectId}/trajectory/aimsg_{messageId}
 * 3. Frontend lê o content.stringValue e renderiza
 *
 * Estratégia:
 * A) Interceptar POST /chat → chamar backend → Claude API (em paralelo)
 * B) Interceptar Firestore Listen → substituir content.stringValue pela resposta do Claude
 */

const CHAT_PATTERN = /api\.lovable\.dev\/projects\/([^/]+)\/chat/
const FIRESTORE_LISTEN_PATTERN = /firestore\.googleapis\.com.*Listen/

// Mapa de ai_message_id → resposta do Claude
const pendingResponses = new Map<string, string>()

// ─── Instalação do interceptor ────────────────────────────────────────────────

type FetchFn = typeof window.fetch

function installInterceptor() {
  const _upstream: FetchFn = window.fetch.bind(window)

  const _proxyFetch: FetchFn = async function (input, init) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url

    if (CHAT_PATTERN.test(url) && (init?.method ?? "GET").toUpperCase() === "POST") {
      return handleChatRequest(url, input, init, _upstream)
    }

    if (FIRESTORE_LISTEN_PATTERN.test(url)) {
      return handleFirestoreListen(url, input, init, _upstream)
    }

    return _upstream(input, init)
  }

  Object.defineProperty(window, "fetch", {
    value: _proxyFetch,
    writable: false,
    configurable: true,
  })

  console.log("[lovable-proxy] Interceptor instalado")
}

installInterceptor()
document.addEventListener("DOMContentLoaded", installInterceptor, { once: true })

// ─── Handler: POST /chat ──────────────────────────────────────────────────────

async function handleChatRequest(
  _url: string,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  upstream: FetchFn
): Promise<Response> {
  let body: Record<string, unknown> = {}
  try {
    const raw =
      typeof init?.body === "string"
        ? init.body
        : new TextDecoder().decode(init?.body as ArrayBuffer)
    body = JSON.parse(raw)
  } catch {
    return upstream(input, init)
  }

  const message = body.message as string
  const aiMessageId = body.ai_message_id as string

  if (!message || !aiMessageId) return upstream(input, init)

  console.log("[lovable-proxy] Chat interceptado →", aiMessageId)

  // Chama Claude em paralelo — não bloqueia o POST original
  callBackend(message, aiMessageId, body)

  return upstream(input, init)
}

async function callBackend(
  message: string,
  aiMessageId: string,
  rawBody: Record<string, unknown>
) {
  // No main world, chrome.runtime não está disponível
  // Usa postMessage para comunicar com o bridge.ts (isolated world)
  window.postMessage({
    type: "LOVABLE_PROXY_CHAT",
    payload: { message, aiMessageId, rawBody },
  }, "*")

  // Aguarda resposta do bridge via postMessage
  return new Promise<void>((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== "LOVABLE_PROXY_RESPONSE") return
      if (event.data?.payload?.aiMessageId !== aiMessageId) return
      window.removeEventListener("message", handler)

      const { ok, response, error } = event.data.payload
      if (!ok) {
        console.error("[lovable-proxy] Backend error:", error)
      } else {
        pendingResponses.set(aiMessageId, response)
        console.log("[lovable-proxy] Resposta Claude pronta para:", aiMessageId)
      }
      resolve()
    }
    window.addEventListener("message", handler)
    // Timeout de 30s
    setTimeout(() => { window.removeEventListener("message", handler); resolve() }, 30000)
  })
}

// ─── Handler: Firestore Listen ────────────────────────────────────────────────

async function handleFirestoreListen(
  _url: string,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  upstream: FetchFn
): Promise<Response> {
  const originalRes = await upstream(input, init)

  if (!originalRes.body) return originalRes

  console.log("[lovable-proxy] Firestore Listen interceptado")

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk)
      if (text.includes("trajectory")) {
        console.log("[lovable-proxy] Firestore chunk com trajectory:", text.slice(0, 200))
      }
      const modified = tryInjectResponse(text)
      controller.enqueue(new TextEncoder().encode(modified))
    },
  })

  originalRes.body.pipeTo(writable).catch(() => {})

  return new Response(readable, {
    status: originalRes.status,
    headers: originalRes.headers,
  })
}

function tryInjectResponse(chunk: string): string {
  if (pendingResponses.size === 0) return chunk

  for (const [aiMessageId, claudeResponse] of pendingResponses.entries()) {
    if (!chunk.includes(aiMessageId)) continue
    if (!chunk.includes('"content"') || !chunk.includes('"stringValue"')) continue

    const modified = chunk.replace(
      /"content"\s*:\s*\{\s*"stringValue"\s*:\s*"[^"]*"/,
      `"content":{"stringValue":${JSON.stringify(claudeResponse)}`
    )

    if (modified !== chunk) {
      console.log("[lovable-proxy] Resposta Claude injetada para:", aiMessageId)
      pendingResponses.delete(aiMessageId)
      return modified
    }
  }

  return chunk
}

export {}
