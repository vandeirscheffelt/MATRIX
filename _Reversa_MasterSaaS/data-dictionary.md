# Dicionário de Dados — MasterSaaS Frontend
> Gerado pelo Arqueólogo (Reversa v1.2.14) — 2026-06-08
> 🟢 CONFIRMADO | 🟡 INFERIDO | 🔴 LACUNA

---

## Entidade: Profile (banco real)

| Campo | Tipo | Obrigatório | Imutável | Notas |
|-------|------|-------------|---------|-------|
| `id` | uuid | ✅ | ✅ | FK auth.users |
| `display_name` | text | ❌ | ❌ | Fallback: `split_part(email,'@',1)` |
| `affiliate_code` | text | ✅ | ✅ 🟢 | 8 chars, alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` |
| `referred_by_id` | uuid | ❌ | ✅ após set 🟢 | FK profiles.id, self-ref bloqueada |
| `created_at` | timestamptz | ✅ | ✅ | default now() |
| `updated_at` | timestamptz | ✅ | ❌ | atualizado pelo trigger |
| `phone` | — | — | — | 🔴 LACUNA: não existe no banco atual |
| `country` | — | — | — | 🔴 LACUNA |
| `preferred_locale` | — | — | — | 🔴 LACUNA |
| `preferred_currency` | — | — | — | 🔴 LACUNA |
| `kyc_status` | — | — | — | 🔴 LACUNA |
| `tax_id_encrypted` | — | — | — | 🔴 LACUNA |

---

## Entidade: Product (localStorage)

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `slug` | string | ✅ | PK lógica |
| `name` | string | ✅ | — |
| `description` | string | ✅ | — |
| `tagline` | string | ❌ | — |
| `prices` | `Partial<Record<CurrencyCode, number>>` | ✅ preferido | BRL, USD, EUR, MXN |
| `price` | number | ❌ | @deprecated |
| `currency` | CurrencyCode | ❌ | @deprecated |
| `fallbackCurrency` | CurrencyCode | ❌ | default "BRL" |
| `commissionRate` | number | ❌ | 0-100 (%) |
| `commissionDuration` | "Lifetime"\|"12 months"\|"6 months"\|"3 months"\|"Custom" | ❌ | — |
| `customDurationMonths` | number | ❌ | se Custom |
| `billingType` | "Monthly"\|"Annual" | ❌ | — |
| `active` | boolean | ❌ | default true 🟡 |
| `acceptingSubscriptions` | boolean | ❌ | 🔴 LACUNA: presente no blueprint, ausente no tipo |
| `coverImage` | string | ❌ | base64 ou URL |
| `sales_copy` | SalesCopy\|SalesCopyByLocale | ❌ | ver abaixo |
| `productUrl` | string | ❌ | 🔴 LACUNA: presente no blueprint, ausente no tipo |
| `productCode` | string | ❌ | 🔴 LACUNA: usado no src= mas ausente no tipo |

---

## Entidade: SalesCopy

| Campo | Tipo | Notas |
|-------|------|-------|
| `headline` | string | Título da promoção guiada |
| `cta` | string | Label do botão |
| `publico` | string[] | Lista de públicos-alvo |
| `mensagens` | `{a: string, b: string}` | Templates A/B de mensagem |
| `steps` | string[] | Passos de ação |
| `vantagem_template` | string | Template com `{{clicks_per_sale}}` |

---

## Entidade: Promotion (in-memory)

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `id` | string | ✅ | — |
| `name` | string | ✅ | — |
| `productSlug` | string | ✅ | FK Product.slug |
| `startDate` | string | ✅ | ISO yyyy-mm-dd |
| `endDate` | string | ✅ | ISO yyyy-mm-dd, end = 23:59:59.999 |
| `commissionRateOverride` | number | ❌ | 0-100 (%) |
| `durationOverride` | PromoDuration | ❌ | — |
| `customDurationMonths` | number | ❌ | se Custom |
| `enabled` | boolean | ✅ | — |
| `performanceEnabled` | boolean | ❌ | ativa modo boost |
| `performanceMinSales` | number | ❌ | threshold de vendas |
| `performanceRateIfReached` | number | ❌ | taxa se atingiu |
| `performanceRateIfNotReached` | number | ❌ | taxa se não atingiu |

---

## Entidade: NetworkSettings (in-memory, singleton)

| Campo | Tipo | Default | Notas |
|-------|------|---------|-------|
| `enabled` | boolean | `true` | — |
| `defaultRatePct` | number | `5` | % comissão de rede |
| `eligibilityDays` | number | `30` | janela de elegibilidade |
| `minSalesRequired` | number | `1` | vendas mínimas no período |

---

## Entidade: NetworkCampaign (in-memory)

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `id` | string | ✅ | — |
| `name` | string | ✅ | — |
| `startDate` | string | ✅ | ISO yyyy-mm-dd |
| `endDate` | string | ✅ | ISO yyyy-mm-dd |
| `ratePctOverride` | number | ❌ | substitui defaultRatePct |
| `eligibilityDaysOverride` | number | ❌ | — |
| `minSalesOverride` | number | ❌ | — |
| `enabled` | boolean | ✅ | — |

---

## Entidade: Subscription (mock/in-memory)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | string | — |
| `customer` | string | nome ou hash `****` |
| `productName` | "Schaikron"\|"Scheffelt AI" | 🔴 deveria ser FK product_id |
| `plan` | "Monthly"\|"Annual" | — |
| `status` | "Active"\|"Pending"\|"Canceled" | — |
| `riskLevel` | "at-risk"? | flag transiente |
| `monthlyValue` | number | preço mensal |
| `commissionPerMonth` | number | monthlyValue × commissionRate |
| `paymentsMade` | number | pagamentos realizados |
| `paymentsTotal` | number | total esperado |
| `nextPaymentDate` | string | — |
| `totalEarned` | number | acumulado |

---

## Entidade: FinanceTransaction (mock/localStorage)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | string | — |
| `date` | string | ISO yyyy-mm-dd |
| `type` | "Commission"\|"Withdrawal" | — |
| `description` | string | — |
| `amount` | number | negativo para withdrawal |
| `status` | "Paid"\|"Pending"\|"Processing"\|"Failed" | — |

---

## Entidade: AdminAffiliate (mock/in-memory)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | string | — |
| `name` | string | — |
| `email` | string | — |
| `currency` | CurrencyCode | — |
| `totalSales` | number | — |
| `commissionEarned` | number | total gerado |
| `pendingAmount` | number | aguardando liberação |
| `approvedAmount` | number | aprovado, não pago |
| `paidAmount` | number | já pago |
| `status` | CommissionStatus | estado atual |
| `sales` | AffiliateSale[] | histórico |
| `payments` | PaymentRecord[] | pagamentos realizados |

---

## Entidade: CommissionStatus (frontend vs blueprint)

| Status Frontend | Equivalente Blueprint | Notas |
|----------------|----------------------|-------|
| `pending` | `pending` | aguardando hold |
| `approved` | `available` | liberado para saque |
| `paid` | `paid` | pago |
| `partially_paid` | 🔴 sem equivalente | backend deve consolidar |
| `reversed` | `refunded` | estorno |
| — | `processing` | 🔴 ausente no frontend |
| — | `canceled` | 🔴 ausente no frontend |
| — | `failed` | 🔴 ausente no frontend |

---

## Entidade: Tutorial (in-memory/localStorage)

| Campo | Tipo | Obrigatório | Notas |
|-------|------|-------------|-------|
| `id` | string | ✅ | — |
| `title` | string | ✅ | — |
| `description` | string | ✅ | — |
| `youtubeUrl` | string | ✅ | watch?v=, youtu.be/, embed/ |
| `category` | TutorialCategory | ✅ | 4 valores |
| `ctaLabel` | string | ✅ | — |
| `ctaTo` | string | ✅ | rota interna |
| `order` | number | ✅ | ordem na categoria |
| `active` | boolean | ✅ | — |
| `required` | boolean | ✅ | obrigatoriedade |

---

## Entidade: SmartAlert (gerada em memória)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | string | determinístico (ex: "alert-sales-spike") |
| `scope` | "global"\|"campaigns"\|"finance"\|"reports" | — |
| `severity` | "info"\|"success"\|"warning"\|"danger" | — |
| `title` | string | — |
| `description` | string | — |
| `action` | `{label: string, to: string}?` | deep-link |
| `icon` | LucideIcon | — |
| `createdAt` | string | ISO date (data da última venda do dataset) |

---

## Entidade: ReferredAffiliate (mock/in-memory)

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | string | — |
| `code` | string | affiliate_code do indicado |
| `joinedAt` | string | ISO yyyy-mm-dd |
| `salesThisMonth` | number | — |
| `totalSales` | number | — |
| `earningsGenerated` | number | lifetime earnings do indicador sobre este indicado |
| `earningsThisMonth` | number | — |
| `lastSaleAt` | string\|null | última venda do indicado |

---

## Constantes globais confirmadas

| Constante | Valor | Localização | Confiança |
|-----------|-------|-------------|-----------|
| `REFERRAL_RATE` | `0.05` (5%) | network-data.ts | 🟢 |
| `defaultRatePct` | `5` | network-settings-store.ts | 🟢 |
| `eligibilityDays` | `30` | network-settings-store.ts | 🟢 |
| `minSalesRequired` | `1` | network-settings-store.ts | 🟢 |
| `baseUrl` | `https://mastersaas.scheffelt.xyz` | mock-data.ts | 🟢 |
| `affiliateCode` mock | `VAN01` | mock-data.ts | 🟢 |
| OTP length | `6` dígitos | login.tsx | 🟢 |
| Senha mínima | `6` chars | signup.tsx | 🟢 |
| Sales spike threshold | `±15%` | alerts-data.ts | 🟢 |
| Top affiliate threshold | `25%` da receita | alerts-data.ts | 🟢 |
| Campaign ending threshold | `≤3 dias` | alerts-data.ts | 🟢 |
| Payout alert threshold | `≥R$100` | alerts-data.ts | 🟢 |
| `PARENT_COOKIE_DAYS` | `14` | 🔴 LACUNA — não encontrado no código | 🔴 |
| `RELEASE_WINDOW_DAYS` | `30` | 🔴 LACUNA — não encontrado no código | 🔴 |
| `SELECTION_LIMIT` | `50` | 🔴 LACUNA — não encontrado no código | 🔴 |
