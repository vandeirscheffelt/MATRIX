// Plasmo: roda em isolated world — faz a ponte entre o interceptor (main world) e o background
export const config = {
  matches: ["https://lovable.dev/*"],
  run_at: "document_start" as const,
}

// Escuta mensagens do interceptor.ts (main world via postMessage)
// e repassa ao background service worker via chrome.runtime
window.addEventListener("message", async (event) => {
  if (event.source !== window) return
  if (event.data?.type !== "LOVABLE_PROXY_CHAT") return

  const { message, aiMessageId, rawBody } = event.data.payload

  try {
    const result = await chrome.runtime.sendMessage({
      type: "LOVABLE_CHAT",
      payload: { message, aiMessageId, rawBody },
    })

    // Devolve a resposta do Claude ao interceptor via postMessage
    window.postMessage({
      type: "LOVABLE_PROXY_RESPONSE",
      payload: { aiMessageId, response: result?.response, ok: result?.ok },
    }, "*")
  } catch (err) {
    window.postMessage({
      type: "LOVABLE_PROXY_RESPONSE",
      payload: { aiMessageId, ok: false, error: String(err) },
    }, "*")
  }
})

export {}
