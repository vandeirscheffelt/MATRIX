import axios from 'axios'

/**
 * Baixa um arquivo do Google Drive.
 *
 * Estratégia (em ordem):
 * 1. Drive API v3 com API Key (se GOOGLE_API_KEY configurado) — mais confiável
 * 2. Endpoint /uc com extração de cookie de confirmação — fallback para arquivos públicos
 *
 * REQUISITO: O arquivo DEVE estar compartilhado como "Qualquer pessoa com o link"
 */
export async function baixarVideoDoDrive(fileId: string): Promise<Buffer> {
  console.log(`[DRIVE] Baixando arquivo ${fileId}...`)

  const apiKey = process.env.GOOGLE_API_KEY
  if (apiKey) {
    return baixarViaApiKey(fileId, apiKey)
  }
  return baixarViaPublicUrl(fileId)
}

// ─── Método 1: Drive API v3 com API Key ──────────────────────────────────────

async function baixarViaApiKey(fileId: string, apiKey: string): Promise<Buffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`
  console.log(`[DRIVE] Usando Drive API v3 com API Key`)

  const res = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    timeout: 10 * 60 * 1000,
    maxContentLength: Infinity,
  })

  const buffer = Buffer.from(res.data)
  validar(buffer, fileId)
  logTamanho(buffer)
  return buffer
}

// ─── Método 2: URL pública /uc (fallback) ────────────────────────────────────

async function baixarViaPublicUrl(fileId: string): Promise<Buffer> {
  // Google mudou o fluxo de confirmação — agora usa cookies NID + download_warning
  // Usamos uma sessão axios com jar de cookies manual

  const baseUrl = `https://drive.google.com/uc?export=download&id=${fileId}`
  console.log(`[DRIVE] Usando URL pública (sem API Key)`)

  // 1a requisição: pega cookies e possível token
  const res1 = await axios.get<ArrayBuffer>(baseUrl, {
    responseType: 'arraybuffer',
    maxRedirects: 5,
    timeout: 10 * 60 * 1000,
  })

  let buffer = Buffer.from(res1.data)
  const html = buffer.toString('utf-8')

  if (!isHtml(buffer)) {
    validar(buffer, fileId)
    logTamanho(buffer)
    return buffer
  }

  console.log(`[DRIVE] Página de confirmação recebida — extraindo token`)

  // Extrai cookies
  const rawCookies = res1.headers['set-cookie'] ?? []
  const cookieStr = rawCookies.map((c: string) => c.split(';')[0]).join('; ')

  // Novo formato Google: busca uuid no atributo action do form
  const uuidMatch = html.match(/action="(\/uc\?[^"]*export=download[^"]*)"/)
  if (uuidMatch) {
    const directPath = uuidMatch[1].replace(/&amp;/g, '&')
    const directUrl = `https://drive.google.com${directPath}`
    console.log(`[DRIVE] Tentando URL de confirmação direta...`)
    const res2 = await axios.get<ArrayBuffer>(directUrl, {
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 10 * 60 * 1000,
      headers: { Cookie: cookieStr },
    })
    buffer = Buffer.from(res2.data)
    if (!isHtml(buffer)) {
      validar(buffer, fileId)
      logTamanho(buffer)
      return buffer
    }
  }

  // Tenta parâmetro confirm=t (funciona para alguns arquivos)
  const confirmUrl = `${baseUrl}&confirm=t&uuid=`
  console.log(`[DRIVE] Tentando confirm=t...`)
  const res3 = await axios.get<ArrayBuffer>(confirmUrl, {
    responseType: 'arraybuffer',
    maxRedirects: 5,
    timeout: 10 * 60 * 1000,
    headers: { Cookie: cookieStr },
  })
  buffer = Buffer.from(res3.data)

  validar(buffer, fileId)
  logTamanho(buffer)
  return buffer
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isHtml(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 200).toString('utf-8')
  return head.includes('<!DOCTYPE') || head.includes('<html')
}

function validar(buffer: Buffer, fileId: string): void {
  if (isHtml(buffer)) {
    throw new Error(
      `Drive retornou HTML em vez do arquivo. ` +
      `Verifique se o arquivo ${fileId} está compartilhado como "Qualquer pessoa com o link". ` +
      `Para arquivos grandes, configure GOOGLE_API_KEY no .env.`
    )
  }
  if (buffer.length < 10_000) {
    throw new Error(
      `Arquivo muito pequeno (${buffer.length} bytes). Verifique o file ID: ${fileId}`
    )
  }
}

function logTamanho(buffer: Buffer): void {
  console.log(`[DRIVE] Download concluído: ${(buffer.length / (1024 * 1024)).toFixed(2)} MB`)
}

// Extrai o file ID de uma URL do Google Drive
export function extrairFileId(url: string): string {
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
  if (!match) throw new Error(`URL do Drive inválida: ${url}`)
  return match[1]
}
