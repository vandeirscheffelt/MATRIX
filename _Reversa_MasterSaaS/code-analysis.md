# Code Analysis — MasterSaaS Frontend
> Gerado pelo Arqueólogo (Reversa v1.2.14) — Nível: Detalhado — 2026-06-08

---

## Visão Geral

O MasterSaaS é um frontend TanStack Start + React 19 com **backend quase inexistente**. Apenas `profiles` + Auth do Supabase estão reais. Todo o restante opera via stores em memória ou localStorage — o frontend **simula um sistema completo**, com tipos, lógica de negócio e estado que precisam ser migrados para um backend real.

---

## Módulo 1 — Auth 🟢 CONFIRMADO

**Arquivos:** `src/hooks/use-auth.tsx`, `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/routes/join.$code.tsx`, `src/integrations/supabase/client.ts`, `src/lib/referral-storage.ts`

### Funções principais

| Função | Localização | Params | Retorno | Confiança |
|--------|-------------|--------|---------|-----------|
| `signUp` | use-auth.tsx | `email, password, displayName?` | `{error: string\|null}` | 🟢 |
| `signIn` | use-auth.tsx | `email, password` | `{error: string\|null}` | 🟢 |
| `signInWithGoogle` | use-auth.tsx | — | `{error: string\|null}` | 🟢 |
| `sendEmailOtp` | use-auth.tsx | `email` | `{error: string\|null}` | 🟢 |
| `verifyEmailOtp` | use-auth.tsx | `email, token` | `{error: string\|null}` | 🟢 |
| `signOut` | use-auth.tsx | — | `Promise<void>` | 🟢 |
| `fetchProfile` | use-auth.tsx | `userId: string` | `Promise<Profile\|null>` | 🟢 |
| `refreshProfile` | use-auth.tsx | — | `Promise<void>` | 🟢 |
| `setRefCode` | referral-storage.ts | `raw: string\|null` | `void` | 🟢 |
| `getRefCode` | referral-storage.ts | — | `string\|null` | 🟢 |
| `clearRefCode` | referral-storage.ts | — | `void` | 🟢 |
| `markWelcomePending` | referral-storage.ts | `inviterCode: string` | `void` | 🟢 |
| `consumeWelcomePending` | referral-storage.ts | — | `string\|null` | 🟢 |

### Regras de negócio críticas
- `signUp` captura `getRefCode()` do localStorage e envia como `referred_by_code` em `raw_user_meta_data` → trigger `handle_new_user` resolve o `referred_by_id` no banco
- `setRefCode` normaliza: UPPERCASE + remove não-alfanuméricos + limita 16 chars
- Supabase client usa lazy init via `Proxy` (instância criada apenas na primeira chamada)
- Auth session persiste em `localStorage` (SSR: undefined storage)
- Profile fetch é **deferred** via `setTimeout(0)` para evitar deadlock do Supabase callback
- Auto-redirect para `/` quando usuário já autenticado acessa `/login` ou `/signup`
- `join.$code.tsx`: chama `setRefCode(code)` → redireciona para `/signup` (anônimo) ou `/` (autenticado)
- Senha mínima: 6 caracteres (validação no `<Input minLength={6}>` do signup)
- OTP: 6 dígitos, tipo `email` via `supabase.auth.verifyOtp`
- Google OAuth: usa `lovable.auth.signInWithOAuth("google")`, não Supabase direto

### Estado real no banco
- ✅ `auth.users` (Supabase Auth)
- ✅ `public.profiles` (id, display_name, affiliate_code, referred_by_id, created_at)
- ✅ Trigger `on_auth_user_created` → `handle_new_user()`
- ✅ `generate_affiliate_code()` — alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, 8 chars, 10 tentativas
- ✅ `profiles_prevent_immutable_changes()` — bloqueia alteração de `affiliate_code` e `referred_by_id`
- ✅ Guard de auto-referência no trigger

---

## Módulo 2 — Dashboard 🟡 INFERIDO

**Arquivos:** `src/routes/index.tsx`, `src/lib/mock-data.ts`, `src/components/growth-engine.tsx`, `src/components/income-breakdown.tsx`, `src/components/top-affiliates.tsx`, `src/components/news-guidance-rail.tsx`

### Dados consumidos (todos mock)
- `mockStats` → `{totalClicks: 1284, totalConversions: 92}`
- `mockGlobalStats` → `{totalClicks: 48250, totalConversions: 3218}`
- `mockDashboardGrowth` → `{clicksThisMonth, salesThisMonth, clicksSinceLastConversion, commissionPerSale}`
- `mockIncomeByProduct` → breakdown por produto
- `mockMonthlyEarnings` → série temporal (6 meses)

### Algoritmo: `vantagem_template`
```
clicks_per_sale = mockStats.totalClicks / mockStats.totalConversions
                = 1284 / 92 ≈ 13.9 clicks/venda
```
Fallback para `mockGlobalStats` quando afiliado tem <20 clicks ou <1 conversão.

### APIs implícitas necessárias
- `GET /me/stats` → totalClicks, totalConversions, MRR
- `GET /me/income-breakdown` → por produto
- `GET /me/earnings/timeseries` → série mensal
- `GET /leaderboard/top-affiliates` → top N por período

---

## Módulo 3 — Links 🟡 INFERIDO

**Arquivos:** `src/routes/links.tsx`, `src/lib/mock-data.ts`

### Função crítica
```typescript
buildAffiliateLink(productSlug: string, code: string = "VAN01"): string
// retorna: "https://mastersaas.scheffelt.xyz/r/{code}/{productSlug}"

buildMainLink(code: string = "VAN01"): string
// retorna: "https://mastersaas.scheffelt.xyz/r/{code}"
```
Formato canônico do link de afiliado — toda atribuição passa por este padrão.

---

## Módulo 4 — Produtos 🟢 CONFIRMADO (tipo) / 🟡 INFERIDO (persistência)

**Arquivos:** `src/lib/products-store.ts`, `src/lib/mock-data.ts`, `src/routes/products.tsx`, `src/routes/admin.products.tsx`

### Tipo `Product` (completo)
```typescript
type Product = {
  slug: string;                    // PK lógica
  name: string;
  description: string;
  tagline?: string;
  price?: number;                  // @deprecated — usar prices
  commissionRate?: number;         // 0-100 (%)
  active?: boolean;
  billingType?: "Monthly" | "Annual";
  commissionDuration?: "Lifetime" | "12 months" | "6 months" | "3 months" | "Custom";
  customDurationMonths?: number;
  coverImage?: string;
  currency?: CurrencyCode;         // @deprecated — usar prices
  prices?: Partial<Record<CurrencyCode, number>>;
  fallbackCurrency?: CurrencyCode;
  sales_copy?: SalesCopy | SalesCopyByLocale;
}
```

### Algoritmo: resolução de preço
```typescript
getProductPrice(product, preferred?): {price, currency}
// 1. Se prices existe: usa preferred → pickCurrency(prices, undefined, fallback)
// 2. Fallback: product.price + product.currency
// fallbackCurrency default: "BRL"
```

### Persistência atual
- Store: `useSyncExternalStore` com localStorage(`"products"`)
- Seed: `mockProducts` (Schaikron + Scheffelt AI)
- CRUD: `upsertProduct`, `updateProductBySlug`, `setProducts`
- ⚠️ SSR server snapshot retorna `mockProducts` (não localStorage)

### Produtos mock reais
| Produto | Slug | Preços | Commission |
|---------|------|--------|------------|
| Schaikron | `schaikron` | BRL:49, USD:12, MXN:220 | 30% |
| Scheffelt AI | `scheffelt-ai` | USD:19, BRL:97, MXN:350, EUR:18 | 30% |

---

## Módulo 5 — Vendas / Assinaturas 🟡 INFERIDO

**Arquivos:** `src/routes/sales.tsx`, `src/lib/mock-data.ts`

### Tipo `Subscription`
```typescript
type Subscription = {
  id: string;
  customer: string;              // hash/name
  productName: "Schaikron" | "Scheffelt AI";
  plan: "Monthly" | "Annual";
  status: "Active" | "Pending" | "Canceled";
  riskLevel?: "at-risk";
  monthlyValue: number;
  commissionPerMonth: number;    // = monthlyValue * commissionRate
  paymentsMade: number;
  paymentsTotal: number;
  nextPaymentDate: string;
  totalEarned: number;
}
```

### KPIs calculados
- `MRR` = soma de `commissionPerMonth` das assinaturas `Active`
- `at-risk count` = assinaturas com `riskLevel === "at-risk"`
- `Active Subscriptions` = count status Active

---

## Módulo 6 — Financeiro Afiliado ⚠️ RISCO CRÍTICO

**Arquivos:** `src/routes/finance.tsx`, `src/lib/mock-data.ts`

### Tipos financeiros
```typescript
type FinanceTransaction = {
  id: string;
  date: string;
  type: "Commission" | "Withdrawal";
  description: string;
  amount: number;     // negativo para withdrawal
  status: "Paid" | "Pending" | "Processing" | "Failed";
}
```

### Estado mock
- `mockFinance`: `{availableBalance: 482.5, pendingBalance: 145.0, totalEarned: 2310.75, totalWithdrawn: 1683.25}`
- Dados bancários (PIX, conta, CPF) salvos em `localStorage("affiliate_payment_details")` — 🔴 PII sem criptografia
- Saques salvos em `localStorage("affiliate_withdrawals")`

### Validações de saque (UI)
- Valor ≥ mínimo (🔴 LACUNA: mínimo não definido no código)
- Valor ≤ `availableBalance`
- Confirmação obrigatória via checkbox `canConfirm`
- Auto-hide de saldo após 30s

---

## Módulo 7 — Financeiro Admin (mais complexo — 1710 LOC) 🟢 CONFIRMADO (tipos)

**Arquivos:** `src/routes/admin.finance.tsx`, `src/lib/admin-finance-data.ts`

### Tipos
```typescript
type CommissionStatus = "pending" | "approved" | "paid" | "partially_paid" | "reversed";
type PaymentMethod = "pix" | "stripe" | "manual";

type PaymentRecord = {
  id: string; amount: number; paidAt: string; paidBy: string;
  method: PaymentMethod; notes?: string; reversed?: boolean; reversedAt?: string;
}

type AdminAffiliate = {
  id: string; name: string; email: string; currency: CurrencyCode;
  totalSales: number; commissionEarned: number;
  pendingAmount: number; approvedAmount: number; paidAmount: number;
  status: CommissionStatus;
  sales: AffiliateSale[]; payments: PaymentRecord[];
}
```

### ⚠️ DIVERGÊNCIA entre frontend e blueprint
O frontend admin usa status: `pending | approved | paid | partially_paid | reversed`
O blueprint especifica: `pending | available | processing | paid | canceled | failed | refunded`
**→ Backend deve usar o schema do blueprint** (mais completo e auditável)

### Constantes observadas
- `RELEASE_WINDOW_DAYS = 30` (🔴 LACUNA: não encontrado explicitamente no código — inferido do blueprint)
- `SELECTION_LIMIT = 50` (🔴 LACUNA: mesma situação)

---

## Módulo 8 — Rede (Network) 🟢 CONFIRMADO

**Arquivos:** `src/lib/network-data.ts`, `src/lib/network-settings-store.ts`, `src/routes/network.tsx`, `src/routes/admin.network.tsx`

### Constantes confirmadas
```typescript
const REFERRAL_RATE = 0.05; // 5% sobre vendas dos indicados
```

### Tipos
```typescript
type NetworkSettings = {
  enabled: boolean;
  defaultRatePct: number;    // default: 5
  eligibilityDays: number;   // default: 30
  minSalesRequired: number;  // default: 1
}

type NetworkCampaign = {
  id: string; name: string; startDate: string; endDate: string;
  ratePctOverride?: number;
  eligibilityDaysOverride?: number;
  minSalesOverride?: number;
  enabled: boolean;
}
```

### Algoritmo: `resolveNetworkRules` 🟢
```typescript
// 1. Carrega settings base (defaultRatePct, eligibilityDays, minSalesRequired)
// 2. Busca campanha ativa via getActiveNetworkCampaign()
// 3. Se campanha ativa: override os campos que estiverem definidos
// 4. Retorna ResolvedNetworkRules com fromCampaign referência
```

### Algoritmo: `isReferralEligible` 🟢
```typescript
(lastPersonalSaleAt, rules, recentSalesCount = 1): boolean
// 1. Se lastPersonalSaleAt é null → false
// 2. Se recentSalesCount < rules.minSales → false
// 3. Calcula dias desde última venda
// 4. Se dias > eligibilityDays → false
// 5. Caso contrário → true
```

### Função: `buildReferralLink`
```typescript
buildReferralLink(code): string
// retorna: "https://mastersaas.scheffelt.xyz/join/{code}"
```

---

## Módulo 9 — Promoções 🟢 CONFIRMADO

**Arquivos:** `src/lib/promotions-store.ts`, `src/routes/promotions.tsx`

### Tipo `Promotion`
```typescript
type Promotion = {
  id: string; name: string; productSlug: string;
  startDate: string; endDate: string;
  commissionRateOverride?: number;
  durationOverride?: "Lifetime" | "12 months" | "6 months" | "3 months" | "Custom";
  customDurationMonths?: number;
  enabled: boolean;
  performanceEnabled?: boolean;
  performanceMinSales?: number;
  performanceRateIfReached?: number;
  performanceRateIfNotReached?: number;
}
type PromotionStatus = "Upcoming" | "Active" | "Expired" | "Disabled";
```

### Algoritmo: `getPromotionStatus` 🟢
```typescript
(p, now = new Date()): PromotionStatus
// 1. !p.enabled → "Disabled"
// 2. now < start → "Upcoming"
// 3. now > end (com 23:59:59) → "Expired"
// 4. caso contrário → "Active"
```

### Algoritmo: `resolveEffectiveRate` 🟢 (CRÍTICO para financeiro)
```typescript
(p, affiliateSalesInCampaign = 0): number | undefined
// Se performanceEnabled:
//   affiliateSalesInCampaign >= performanceMinSales → performanceRateIfReached
//   caso contrário → performanceRateIfNotReached
// Se não: → commissionRateOverride
```

### Algoritmo: `daysRemaining` + `timeRemaining`
- End date ajustado para 23:59:59.999 antes do cálculo
- `timeRemaining` retorna `{days, hours, minutes, seconds, totalMs}` para countdown

---

## Módulo 10 — Tutoriais 🟢 CONFIRMADO

**Arquivos:** `src/lib/tutorials-store.ts`

### Tipo `Tutorial`
```typescript
type Tutorial = {
  id: string; title: string; description: string;
  youtubeUrl: string;           // watch?v=, youtu.be/, embed/
  category: "getting-started" | "first-sale" | "scaling-sales" | "campaigns";
  ctaLabel: string; ctaTo: string;  // deep-link interno
  order: number; active: boolean; required: boolean;
}
```

### Algoritmo: `extractYoutubeId` 🟢
```typescript
// 1. Se já é ID de 11 chars → retorna direto
// 2. youtu.be → pathname.split('/')[0]
// 3. youtube.com → ?v= param || /embed/ || /shorts/
// 4. Falha → null
```

### Categorias: 4 fixas, 2 tutoriais cada = 8 tutoriais seed
- Persistência: `localStorage("mastersaas:tutorials:v1")` (🔴 LACUNA: chave não encontrada no código — inferido do blueprint)

---

## Módulo 11 — Notícias (News) 🔴 LACUNA

**Arquivos:** `src/lib/news-store.ts` (não lido — estrutura inferida dos blueprints)

Tipo esperado: `{ id, type, displayLocation, priority, active, translations[] }`
`displayLocation`: `dashboard | network | products | links | tutorials`

---

## Módulo 12 — Relatórios Admin 🟡 INFERIDO

**Arquivos:** `src/routes/admin.reports.tsx`, `src/lib/admin-sales-data.ts`

Charts identificados: revenue trend, funnel clicks→conversões, top affiliates, breakdown por produto.
Todos consomem dados mock + `generateAlerts()`.

---

## Módulo 13 — Smart Alerts 🟢 CONFIRMADO

**Arquivos:** `src/lib/alerts-data.ts`

### Algoritmo: `generateAlerts()` 🟢
Detecta 5 classes de alertas por análise do dataset:
1. **Sales spike/drop**: compara receita da metade recente vs metade anterior (threshold ±15%)
2. **Top affiliate**: se um afiliado gera ≥25% da receita recente → alerta info
3. **Campaign ending**: promoção ativa com ≤3 dias → alerta warning
4. **Campaign strong**: ≥3 vendas numa campanha ativa → alerta success
5. **Payout available**: `availableBalance ≥ 100` → alerta success
6. **Pending approvals**: affiliates com status `pending` → alerta warning

### Ordenação: `danger → warning → success → info`, depois mais recente primeiro

### Tipos
```typescript
type AlertSeverity = "info" | "success" | "warning" | "danger";
type AlertScope = "global" | "campaigns" | "finance" | "reports";
```

---

## Módulo 14 — Referral Tracking 🟢 CONFIRMADO (parcial)

**Arquivos:** `src/routes/join.$code.tsx`, `src/routes/r.$userId.$productSlug.tsx` (🔴 não encontrado na lista — rota pode estar ausente ou no routeTree)

### Fluxo confirmado `/join/:code`
1. `setRefCode(code)` → localStorage
2. Se autenticado → redireciona `/`
3. Se anônimo → redireciona `/signup`
4. ⚠️ Nunca reatribui referrer de usuário já autenticado

### Fluxo esperado `/r/:userId/:productSlug` 🟡 INFERIDO
1. `setAffiliateParent(userId)` → localStorage + cookie 14d (🔴 função não encontrada em referral-storage.ts — pode estar em outro módulo ou ausente)
2. Resolve produto via `useProducts()`
3. Se ativo: redirect para `productUrl?ref={userId}&src=MASTERSAAS|AFIL|{ref}|{productCode}`
4. Se inativo: tela de erro

### Formato `src` canônico
```
src = "MASTERSAAS|AFIL|{affiliateCode}|{productCode}"
```

---

## Módulo 15 — i18n & Currency 🟢 CONFIRMADO

**Arquivos:** `src/lib/i18n.ts`, `src/hooks/use-locale.ts`, `src/lib/geo.ts`

- Locales: `pt`, `en`, `es` (UI) + BCP47 para tutoriais/news
- Currencies: `BRL`, `USD`, `EUR`, `MXN`
- Resolução: URL > user choice (LS) > geo (IP) > fallbackCurrency > BRL
- `getFxRateFromBRL()` — 🔴 implementação estática (necessário fonte real: ECB API ou cache diário)
- ~2.400 chaves de tradução em `i18n.ts`

---

## Módulo 16 — Conta / Perfil 🟢 CONFIRMADO

**Arquivos:** `src/routes/account.tsx`, `src/hooks/use-auth.tsx`

Dados reais: `display_name`, `email`, `affiliate_code`, `referred_by_id`
Dado mock: `phone` (vem de `user.phone ?? mockUser.phone`)

---

## Módulo 17 — WhatsApp Admin 🔴 LACUNA

**Arquivos:** `src/routes/admin.whatsapp.tsx`

Estado salvo em `localStorage("admin.whatsapp.config.v1")` — 🔴 token de acesso em texto puro no LS.
Providers: Meta Cloud API (token + phoneNumberId) ou Evolution API (QR mock).

---

## Gaps Críticos Identificados

| # | Gap | Severidade | Módulo |
|---|-----|-----------|--------|
| 1 | PII financeira (dados bancários) em localStorage sem criptografia | 🔴 CRÍTICO | Finance |
| 2 | Token WhatsApp em localStorage sem criptografia | 🔴 CRÍTICO | WhatsApp Admin |
| 3 | Roles (admin/affiliate) inexistentes no backend | 🔴 CRÍTICO | Auth/Todos |
| 4 | Tracking de cliques inexistente no servidor | 🔴 ALTO | Referral |
| 5 | Release de comissão em useEffect (frágil) | 🔴 ALTO | Finance Admin |
| 6 | `setAffiliateParent` (cookie 14d) não encontrado no código | 🟡 MÉDIO | Referral |
| 7 | Rota `/r/:userId/:slug` ausente ou não mapeada | 🟡 MÉDIO | Referral |
| 8 | Status de comissão diverge entre frontend e blueprint | 🟡 MÉDIO | Finance |
| 9 | `RELEASE_WINDOW_DAYS` e `SELECTION_LIMIT` não encontrados no código | 🟡 MÉDIO | Finance Admin |
| 10 | `getFxRateFromBRL()` estático | 🟡 BAIXO | i18n/Currency |
| 11 | Zero testes automatizados | 🟡 BAIXO | Global |
