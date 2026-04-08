import { useEffect, useState } from "react"

const PROXY_BACKEND_URL = "http://localhost:3333"

function IndexPopup() {
  const [status, setStatus] = useState<"checking" | "online" | "offline">("checking")

  useEffect(() => {
    fetch(`${PROXY_BACKEND_URL}/health`)
      .then((r) => setStatus(r.ok ? "online" : "offline"))
      .catch(() => setStatus("offline"))
  }, [])

  const dot = { checking: "🟡", online: "🟢", offline: "🔴" }[status]
  const label = { checking: "Verificando...", online: "Online", offline: "Offline" }[status]

  return (
    <div style={{ width: 260, padding: 16, fontFamily: "sans-serif" }}>
      <h2 style={{ margin: "0 0 12px" }}>Lovable Proxy</h2>

      <div style={{ marginBottom: 8 }}>
        <strong>Backend:</strong> {dot} {label}
      </div>

      <div style={{ marginBottom: 8 }}>
        <strong>URL:</strong> <code>{PROXY_BACKEND_URL}</code>
      </div>

      <hr />
      <small style={{ color: "#666" }}>
        Abra <strong>lovable.dev</strong> → DevTools → Network e envie um prompt para mapear os
        endpoints que precisam ser interceptados.
      </small>
    </div>
  )
}

export default IndexPopup
