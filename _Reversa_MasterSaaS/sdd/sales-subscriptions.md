# Sales & Subscriptions — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Módulo responsável por registrar vendas atribuídas a afiliados e gerenciar o ciclo de vida de assinaturas recorrentes. É o ponto de entrada de receita no sistema — toda comissão nasce de uma venda. Hoje opera com dados mock.

**Fluxo confirmado (2026-06-08):**
LIADS envia link ao lead → lead acessa Evolia (`app.shaikron.scheffelt.xyz/account`) → paga via AppMax ou Stripe (já configurados no Evolia) → webhook dispara para MasterSaaS → MasterSaaS registra `mastersaas.sales` e distribui comissões. O produto vendido é o próprio Evolia — o checkout já existe, MasterSaaS só precisa receber o webhook e atribuir a venda ao afiliado correto via parâmetro `src` ou `ref` capturado no link de afiliado.

---

## Responsabilidades

- Registrar vendas atribuídas a afiliados via webhook de pagamento 🔴 (não implementado)
- Manter estado de assinaturas ativas com MRR, risco e próximo pagamento 🟡
- Calcular MRR agregado por afiliado 🟡
- Sinalizar assinaturas em risco (`at-risk`) via webhook `invoice.payment_failed` 🔴
- Gerar comissão inicial na conversão 🔴
- Gerar comissões recorrentes mensalmente via CRON 🔴
- Interromper geração de comissões ao cancelar assinatura 🟡
- Preservar comissões históricas mesmo após cancelamento 🟡
- Expor painel de vendas por período com filtros para o afiliado 🟡

---

## Interface

### Tipo `Sale` (a criar no backend)

```typescript
type Sale = {
  id: string                        // uuid
  customer_email_hash: string       // SHA-256 do email — nunca PII em texto
  phone: string | null              // telefone do comprador capturado pelo LIADS
  product_id: string                // FK products.slug
  affiliate_id: string              // uuid FK profiles
  campaign_id?: string              // uuid FK promotions (snapshot — se havia promo ativa)
  revenue: number                   // valor bruto da venda
  currency: CurrencyCode            // moeda da venda (BRL, USD…)
  gateway: "stripe" | "appmax"      // gateway que processou
  external_payment_id: string       // Stripe payment_intent ou AppMax charge id — UK
  source: string | null             // parâmetro src do link: MASTERSAAS|AFIL|{code}|{productCode}
  status: "completed" | "pending" | "refunded"
  created_at: string                // ISO timestamptz
}
// ✅ Decisão (2026-06-08): commission_snapshot e commission_rate_snapshot REMOVIDOS de Sale.
// Sale guarda o fato bruto (quem, quanto, qual gateway).
// Todo cálculo de comissão vive exclusivamente em mastersaas.commissions — fonte única de verdade.
```

### Tipo `Subscription` (frontend mock)

```typescript
type Subscription = {
  id: string
  customer: string                  // nome ou hash mascarado (ex: "j****a@acme.io")
  productName: "Schaikron" | "Scheffelt AI"
  plan: "Monthly" | "Annual"
  status: "Active" | "Pending" | "Canceled"
  riskLevel?: "at-risk"
  monthlyValue: number
  commissionPerMonth: number        // monthlyValue × commissionRate
  paymentsMade: number
  paymentsTotal: number             // total de pagamentos esperados
  nextPaymentDate: string
  totalEarned: number               // acumulado pago ao afiliado
}
```

### Tipo `SaleEvent` (frontend mock)

```typescript
type SaleEvent = {
  id: string
  date: string
  productName: string
  eventType: "Signup" | "Purchase"
  status: "Confirmed" | "Pending"
}
```

### KPIs do painel `/sales`

```typescript
// Calculados a partir das subscriptions do afiliado
MRR = Σ commissionPerMonth WHERE status === "Active"
ActiveSubscriptions = count WHERE status === "Active"
AtRiskCount = count WHERE riskLevel === "at-risk"
PendingEarnings = Σ commissionPerMonth WHERE status === "Pending"
```

---

## Regras de Negócio

- Toda venda deve ter `external_payment_id` único — idempotência obrigatória no webhook 🟢
- `commission_rate_snapshot` é imutável após criação — alterações no produto não retroagem 🟢
- `customer_email_hash` nunca deve ser PII em texto — usar SHA-256 🟡
- Comissão nasce em status `pending` com `hold_until = created_at + 30 dias` 🟡
- Assinatura `Canceled` interrompe geração de comissões futuras — históricas preservadas 🟢
- CRON mensal gera nova commission para cada subscription `Active` dentro da duração configurada 🔴
- `paymentsTotal` derivado de `commissionDuration`: "12 months" → 12, "Lifetime" → null (sem limite) 🟡
- Flag `at-risk` ativada por webhook `invoice.payment_failed` — desativada por `invoice.payment_succeeded` 🔴
- Assinatura `Pending` = cadastro sem primeiro pagamento confirmado 🟡
- `referrer_affiliate_id` preenchido se indicador era elegível no momento da venda 🟡
- `campaign_id` preenchido se havia promoção ativa para o produto no momento da venda 🟡
- Customer mascarado na UI: nome real ou padrão `j****a@acme.io` por privacidade 🟢

---

## Fluxo Principal — Conversão de Venda (via Stripe webhook)

1. Stripe envia `POST /api/public/webhook/stripe` com evento `checkout.session.completed`
2. Backend valida assinatura HMAC com `timingSafeEqual`
3. Dedupe: verifica `webhook_events(stripe_event_id)` — se já existe, retorna 200 sem processar
4. Extrai `payment_intent_id`, `customer_email`, `metadata.affiliate_id`, `metadata.product_slug`
5. Resolve campanha ativa: `getActivePromotionForProduct(productSlug, saleDate)`
6. Resolve taxa efetiva: `resolveEffectiveRate(promo, affiliateSalesInCampaign)`
7. Calcula: `commission = revenue × effectiveRate / 100`
8. INSERT em `sales` com todos os snapshots
9. INSERT em `commissions` com `status = "pending"`, `hold_until = now + 30 days`
10. Se `referrer_affiliate_id` definido e elegível: INSERT em `referral_commissions`
11. Emite evento `commission.created` para n8n
12. Retorna 200

## Fluxo Principal — Comissão Recorrente (CRON mensal)

1. CRON executa no 1º dia de cada mês às 00:10 UTC
2. SELECT subscriptions WHERE status = 'active' AND payments_made < payments_total (ou Lifetime)
3. Para cada subscription: INSERT nova commission com snapshot das taxas atuais
4. UPDATE subscriptions SET payments_made = payments_made + 1
5. Se payments_made = payments_total: não gera mais comissões (duração esgotada)

## Fluxo Alternativo — Cancelamento de Assinatura

1. Stripe envia `customer.subscription.deleted`
2. UPDATE subscriptions SET status = 'canceled', canceled_at = now
3. Comissões existentes preservadas — nenhuma alteração
4. CRON não gera mais comissões para esta subscription
5. Emite alerta de assinatura cancelada para o afiliado via n8n

---

## Fluxos Alternativos

- **Pagamento falhou (`invoice.payment_failed`):** UPDATE subscriptions SET risk_level = 'at-risk' 🔴
- **Pagamento recuperado (`invoice.payment_succeeded` pós-falha):** UPDATE SET risk_level = null 🔴
- **Reembolso (`charge.refunded`):** UPDATE sales SET status = 'refunded'; UPDATE commission SET status = 'refunded', canceled_at = now 🔴
- **Subscription já existente no webhook:** dedupe por `external_payment_id` — retorna 200 sem criar duplicata 🟡
- **Afiliado sem `referrer_affiliate_id`:** comissão de rede não gerada — normal 🟢

---

## Dependências

- `mock-data.ts` — `Subscription`, `SaleEvent`, `mockSubscriptions`, `mockSales` 🟢
- `promotions-store.ts` — `getActivePromotionForProduct`, `resolveEffectiveRate` 🟡
- `network-settings-store.ts` — `isReferralEligible` para comissão de rede 🟡
- Stripe SDK (backend) — webhook validation, event parsing 🔴
- `commissions` module — cria commission após cada venda 🔴
- `referral_attributions` — resolve `referrer_affiliate_id` 🔴
- CRON (pg_cron ou n8n) — geração recorrente mensal 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Idempotência | `external_payment_id` único — dedupe obrigatório no webhook | blueprints | 🟡 |
| Segurança | HMAC validation em todo webhook Stripe | blueprints | 🟡 |
| Privacidade | `customer_email_hash` — nunca PII em texto | mock usa mascaramento | 🟢 |
| Consistência | commission_rate_snapshot imutável | blueprints | 🟡 |
| Disponibilidade | CRON mensal deve ter retry em caso de falha | 🔴 não especificado | 🔴 |
| Performance | Geração em lote de comissões recorrentes via INSERT...SELECT | blueprints (10k subs) | 🟡 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Venda atribuída
Dado que afiliado VAN01 gerou clique rastreado para "schaikron"
Quando cliente completa compra de R$49
E Stripe envia checkout.session.completed
Então sale é criado com affiliate_id = VAN01
E commission é criada com status = "pending", commission = 14.70 (30%)
E hold_until = data da venda + 30 dias

# Happy path — Idempotência de webhook
Dado que Stripe envia o mesmo checkout.session.completed duas vezes
Quando segundo evento é processado
Então sistema retorna 200 sem criar duplicata (stripe_event_id já existe)

# Happy path — Comissão recorrente
Dado que subscription do cliente está Active com 3 de 12 pagamentos
Quando CRON mensal executa
Então nova commission é criada com payments_made incrementado para 4

# Happy path — Duração esgotada
Dado que subscription tem commissionDuration = "3 months" e payments_made = 3
Quando CRON mensal executa
Então nenhuma nova commission é gerada para esta subscription

# Falha — Cancelamento
Dado que subscription está Active
Quando Stripe envia customer.subscription.deleted
Então subscription status = "canceled", canceled_at = now
E comissões históricas permanecem intactas

# Falha — Reembolso após comissão gerada
Dado que sale foi refundada pelo Stripe
Quando charge.refunded é recebido
Então sale.status = "refunded"
E commission.status = "refunded", commission.canceled_at = now

# Borda — Comissão de Lifetime
Dado que produto tem commissionDuration = "Lifetime"
Quando subscription está Active após 12 meses
Então CRON continua gerando comissão indefinidamente (sem payments_total)
```

---

## Cenários de Borda (detalhado)

1. **Webhook recebido antes do afiliado estar cadastrado:** `metadata.affiliate_id` não encontrado em `profiles`. Necessário: fila de reprocessamento com retry após N minutos, ou fallback para "venda não atribuída" sem comissão.

2. **Assinatura anual com comissão mensal:** `plan = "Annual"` mas `commissionDuration = "12 months"`. Stripe fatura anualmente mas CRON gera comissão mensalmente. Necessário: mapear `payments_made` para meses, não para pagamentos Stripe.

3. **Dois webhooks `invoice.payment_succeeded` em sequência:** Assinatura com retry automático do Stripe pode reenviar. Dedupe por `stripe_event_id` resolve — mas se for evento de `subscription_cycle` diferente, pode gerar duplicata. Necessário: unicidade por `(subscription_id, billing_period)`.

4. **Reembolso após payout já realizado:** Sale refundada, comissão já em status `paid`. Necessário: `commission_reversal` — débito futuro no saldo do afiliado sem alterar a comissão original. Não zerar registro histórico.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Webhook Stripe → sale + commission | Must | Entrada de receita — sem isso sistema não funciona |
| Idempotência via stripe_event_id | Must | Duplicatas destroem financeiro |
| commission_rate_snapshot imutável | Must | Integridade financeira core |
| Cancelamento de assinatura | Must | Interrompe comissões futuras |
| CRON de comissão recorrente | Must | Modelo de negócio é recorrente |
| Flag at-risk | Should | Alertas e recuperação de churn |
| Reembolso + reversal | Should | Necessário em produção, mas raramente acionado |
| Comissão de rede na venda | Should | Depende de Network module |
| Painel de vendas UI (afiliado) | Should | Visibilidade — não bloqueia negócio |
| Geração em lote (INSERT...SELECT) | Could | Otimização para >1k assinaturas |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/mock-data.ts` | `Subscription`, `SaleEvent`, `mockSubscriptions`, `mockSales`, `mockMonthlyEarnings` | 🟢 |
| `src/routes/sales.tsx` | `SalesPage` | 🟡 não lido diretamente |
| `src/routes/admin.sales.tsx` | `AdminSalesPage` | 🟡 não lido diretamente |
| `src/lib/admin-sales-data.ts` | `mockAdminSales` | 🟡 não lido diretamente |
| Backend webhook handler | — | 🔴 não existe |
| CRON job mensal | — | 🔴 não existe |
