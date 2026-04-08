/**
 * Background Service Worker
 *
 * Recebe LOVABLE_CHAT do content script,
 * chama o backend local que chama Claude API,
 * e devolve o resultado.
 */

const PROXY_BACKEND_URL = "http://localhost:3333"

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "LOVABLE_CHAT") return false

  handleChat(message.payload)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: String(err) }))

  return true // canal assíncrono
})

interface ChatPayload {
  message: string
  aiMessageId: string
  rawBody: Record<string, unknown>
}

async function handleChat(payload: ChatPayload) {
  const { message, aiMessageId, rawBody } = payload

  const res = await fetch(`${PROXY_BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, aiMessageId, rawBody }),
  })

  if (!res.ok) {
    return { ok: false, error: `Backend ${res.status}` }
  }

  const { response } = await res.json()
  return { ok: true, response }
}
