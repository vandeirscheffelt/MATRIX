import type { FastifyInstance } from 'fastify'
import { supabaseAdmin, supabaseMasterSaaS } from '../../lib/supabase.js'

// Cookie name para atribuição de afiliado (14 dias)
const AFFILIATE_COOKIE = 'ms_affiliate_ref'
const COOKIE_TTL_DAYS = 14
const COOKIE_TTL_SECONDS = COOKIE_TTL_DAYS * 24 * 60 * 60

// Normaliza affiliate_code: UPPERCASE + remove não-alfanumérico + limita 16 chars
function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
}

// Monta src param canônico: MASTERSAAS|AFIL|{code}|{productCode}
function buildSrc(code: string, productCode: string): string {
  return `MASTERSAAS|AFIL|${code}|${productCode}`
}

export async function msReferralRoutes(app: FastifyInstance) {
  const db    = supabaseMasterSaaS()
  const admin = supabaseAdmin()

  // ─── GET /mastersaas/r/:code/:slug ─────────────────────────────────────────
  //
  // Fluxo:
  // 1. Normaliza e valida o affiliate_code em public.profiles
  // 2. Valida produto ativo em mastersaas.products
  // 3. Persiste cookie HttpOnly de 14 dias (first-click: não sobrescreve se já existe)
  // 4. Redireciona 302 para product_url com ?ref=&src=
  //
  // Se produto inativo → 302 para /produto-indisponivel no frontend
  // Se código inválido → 302 para destino sem parâmetros de afiliado (não quebra o lead)

  app.get<{ Params: { code: string; slug: string } }>(
    '/:code/:slug',
    async (request, reply) => {
      const code = normalizeCode(request.params.code)
      const slug = request.params.slug

      const frontendUrl = process.env.MASTERSAAS_FRONTEND_URL ?? 'https://mastersaas.scheffelt.xyz'

      // ── 1. Valida produto ──────────────────────────────────────────────────
      const { data: product, error: productError } = await db
        .from('products')
        .select('slug, name, product_url, product_code, active, accepting_subscriptions')
        .eq('slug', slug)
        .single()

      if (productError || !product) {
        // Produto inexistente → redireciona para home sem params
        return reply.redirect(302, frontendUrl)
      }

      if (!product.active || !product.accepting_subscriptions) {
        // Produto inativo → página de produto indisponível
        return reply.redirect(302, `${frontendUrl}/produto-indisponivel?slug=${slug}`)
      }

      // ── 2. Valida affiliate_code ───────────────────────────────────────────
      let validCode = code

      if (code) {
        const { data: profile } = await admin
          .from('profiles')
          .select('id, affiliate_code')
          .eq('affiliate_code', code)
          .single()

        if (!profile) {
          // Código inválido → redireciona sem parâmetros de afiliado
          // Não quebra o lead — ele ainda chega ao produto
          return reply.redirect(302, product.product_url)
        }
      }

      // ── 3. Cookie first-click (não sobrescreve se já existe) ───────────────
      const existingCookie = (request.cookies as any)?.[AFFILIATE_COOKIE]

      if (!existingCookie && validCode) {
        const cookieValue = JSON.stringify({
          code: validCode,
          slug,
          ts: Date.now(),
        })

        reply.setCookie(AFFILIATE_COOKIE, cookieValue, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: COOKIE_TTL_SECONDS,
          path: '/',
        })
      }

      // ── 4. Redirect com src param ──────────────────────────────────────────
      const src = buildSrc(validCode, product.product_code)
      const separator = product.product_url.includes('?') ? '&' : '?'
      const destination = `${product.product_url}${separator}ref=${validCode}&src=${encodeURIComponent(src)}`

      return reply.redirect(302, destination)
    }
  )

  // ─── GET /mastersaas/r/:code ───────────────────────────────────────────────
  // Link genérico de recrutamento de rede (sem produto específico)
  // Redireciona para a home do MasterSaaS com ref= para captura no signup

  app.get<{ Params: { code: string } }>(
    '/:code',
    async (request, reply) => {
      const code = normalizeCode(request.params.code)
      const frontendUrl = process.env.MASTERSAAS_FRONTEND_URL ?? 'https://mastersaas.scheffelt.xyz'

      if (!code) return reply.redirect(302, frontendUrl)

      // Valida código
      const { data: profile } = await admin
        .from('profiles')
        .select('affiliate_code')
        .eq('affiliate_code', code)
        .single()

      if (!profile) return reply.redirect(302, frontendUrl)

      // First-click: não sobrescreve cookie existente
      const existingCookie = (request.cookies as any)?.[AFFILIATE_COOKIE]
      if (!existingCookie) {
        reply.setCookie(AFFILIATE_COOKIE, JSON.stringify({ code, ts: Date.now() }), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: COOKIE_TTL_SECONDS,
          path: '/',
        })
      }

      // Redireciona para /join/:code no frontend (captura referral para signup)
      return reply.redirect(302, `${frontendUrl}/join/${code}`)
    }
  )

  // ─── GET /mastersaas/referral/attribution ──────────────────────────────────
  // Lê o cookie de atribuição atual — usado pelo frontend no momento do signup
  // para pré-preencher o referred_by_code

  app.get('/attribution', async (request, reply) => {
    const cookieRaw = (request.cookies as any)?.[AFFILIATE_COOKIE]
    if (!cookieRaw) return { attribution: null }

    try {
      const attribution = JSON.parse(cookieRaw)
      const ageMs = Date.now() - (attribution.ts ?? 0)
      const expired = ageMs > COOKIE_TTL_DAYS * 24 * 60 * 60 * 1000

      if (expired) {
        reply.clearCookie(AFFILIATE_COOKIE, { path: '/' })
        return { attribution: null }
      }

      return { attribution }
    } catch {
      return { attribution: null }
    }
  })
}
