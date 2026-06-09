# Promotions — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Módulo responsável por campanhas promocionais que sobrescrevem a taxa de comissão padrão de um produto durante uma janela temporal. Suporta Performance Boost — mecanismo de taxa condicional baseado no volume de vendas do afiliado na campanha. É operação exclusiva de Admin (decisão arquitetural registrada em ADR-002). Hoje persiste in-memory — destino é tabela `promotions` no banco.

---

## Responsabilidades

- Armazenar e servir CRUD de promoções por produto 🟢
- Calcular status de promoção em tempo real (Upcoming/Active/Expired/Disabled) 🟢
- Resolver taxa efetiva de comissão considerando Performance Boost 🟢
- Calcular tempo restante de campanha para countdown na UI 🟢
- Identificar promoção ativa para um produto em um momento dado 🟢
- Calcular taxa máxima alcançável numa campanha (copy de "earn up to X%") 🟢
- Persistir estado in-memory (temporário) — sem localStorage 🟢

---

## Interface

### Tipo `Promotion`

```typescript
type Promotion = {
  id: string
  name: string
  productSlug: string              // FK products.slug
  startDate: string                // ISO yyyy-mm-dd
  endDate: string                  // ISO yyyy-mm-dd — tratado como 23:59:59.999
  commissionRateOverride?: number  // 0–100 (%)
  durationOverride?: PromoDuration
  customDurationMonths?: number
  enabled: boolean
  // Performance Boost:
  performanceEnabled?: boolean
  performanceMinSales?: number
  performanceRateIfReached?: number
  performanceRateIfNotReached?: number
}

type PromotionStatus = "scheduled" | "active" | "expired" | "disabled"
// ⚠️ padronizado para lowercase — compatível com OpenAPI. "Upcoming" renomeado para "scheduled".
type PromoDuration = "Lifetime" | "12 months" | "6 months" | "3 months" | "Custom"
```

### Funções principais

```typescript
// Status calculado — nunca armazenado
getPromotionStatus(p: Promotion, now?: Date): PromotionStatus

// Taxa efetiva considerando Performance Boost
resolveEffectiveRate(p: Promotion, affiliateSalesInCampaign?: number): number | undefined

// Promoção ativa para um produto
getActivePromotionForProduct(slug: string, now?: Date): Promotion | undefined

// Duração da comissão em meses (null = Lifetime, undefined = sem override)
resolvePromoDurationMonths(p: Promotion): number | null | undefined

// Contagem regressiva
daysRemaining(p: Promotion, now?: Date): number
timeRemaining(p: Promotion, now?: Date): { days, hours, minutes, seconds, totalMs }

// Taxa máxima alcançável (para copy "earn up to X%")
maxAchievableRate(p: Promotion): number | undefined

// CRUD
upsertPromotion(p: Promotion): void
togglePromotion(id: string): void
getPromotions(): Promotion[]
usePromotions(): Promotion[]   // hook React
```

---

## Regras de Negócio

- Status é calculado, nunca armazenado — deriva de `enabled`, `startDate` e `endDate` 🟢
- `endDate` é tratado como `23:59:59.999` — inclui o dia inteiro 🟢
- `enabled = false` → status `"disabled"` independente das datas 🟢
- `now < startDate` → `"scheduled"`; `startDate ≤ now ≤ endDate` → `"active"`; `now > endDate` → `"expired"` 🟢
- Taxa de comissão snapshotada na venda — alterar `commissionRateOverride` durante campanha não afeta comissões já geradas 🟡
- `resolveEffectiveRate` com `performanceEnabled = false` → retorna `commissionRateOverride` 🟢
- `resolveEffectiveRate` com `performanceEnabled = true`:
  - `affiliateSalesInCampaign >= performanceMinSales` → `performanceRateIfReached`
  - `affiliateSalesInCampaign < performanceMinSales` → `performanceRateIfNotReached` 🟢
- Threshold do Performance Boost usa `>=` (inclusivo) 🟢
- Performance Boost é **prospectivo** — apenas a venda que atinge o threshold e as seguintes ganham a taxa maior; vendas anteriores mantêm a taxa "not reached" 🟢 *(decisão confirmada 2026-06-08)*
- **Obrigatório na UI:** exibir aviso claro na campanha: "As vendas realizadas antes de atingir o threshold não são recalculadas" — evita percepção de lesão pelo afiliado 🟢
- `maxAchievableRate` retorna o maior entre `performanceRateIfReached` e `performanceRateIfNotReached` 🟢
- Promoção in-memory — perde estado no reload do servidor 🟢
- CRUD de promoções é exclusivo de Admin (ADR-002) 🟢
- Pode haver no máximo uma promoção `Active` por produto em um dado momento 🟡

---

## Fluxo Principal — Resolução de Taxa na Venda

1. Webhook de compra recebido (produto X, afiliado Y)
2. `getActivePromotionForProduct(productSlug, saleDate)`
3. Se promoção ativa existe:
   - Conta vendas do afiliado Y nessa campanha: `promotion_performance.sales_count`
   - `resolveEffectiveRate(promo, salesCount)`
   - Retorna taxa override (com ou sem boost)
4. Se não há promoção ativa:
   - Usa `product.commissionRate` base
5. `commission = revenue × effectiveRate / 100`
6. Snapshot da taxa na comissão gerada — imutável

## Fluxo Principal — Countdown na UI

1. `timeRemaining(promo, now)` calcula ms até `endDate 23:59:59.999`
2. Componente `PromoCountdown` atualiza a cada segundo via `setInterval`
3. Ao expirar (`totalMs = 0`): status muda para "Expired" na próxima checagem
4. UI exibe `{days}d {hours}h {minutes}m {seconds}s`

## Fluxo Principal — CRUD Admin

1. Admin acessa `/promotions`
2. Cria/edita promoção: nome, produto, datas, taxa override, duração override, performance boost
3. `upsertPromotion(p)` → atualiza store in-memory → `emit()` notifica subscribers
4. Toggle ativo/inativo: `togglePromotion(id)` → inverte `enabled`
5. 🔴 Sem persistência real — perde ao recarregar

---

## Fluxos Alternativos

- **Sem promoção ativa para produto:** `getActivePromotionForProduct` retorna `undefined` → usa commissionRate base 🟢
- **Promoção com Performance Boost e afiliado sem vendas:** `affiliateSalesInCampaign = 0` < `performanceMinSales` → `performanceRateIfNotReached` 🟢
- **`commissionRateOverride` ausente sem Performance Boost:** `resolveEffectiveRate` retorna `undefined` → backend usa commissionRate do produto 🟢
- **`durationOverride = "Lifetime"`:** `resolvePromoDurationMonths` retorna `null` → comissão recorrente indefinida 🟢
- **`durationOverride = "Custom"`:** retorna `customDurationMonths ?? null` 🟢
- **Múltiplas promoções ativas para mesmo produto:** `getActivePromotionForProduct` retorna a primeira encontrada — comportamento não determinístico 🟡
- **Admin altera taxa durante campanha ativa:** Override aplicado a vendas futuras; comissões existentes preservadas (snapshot) 🟡

---

## Dependências

- `promotions-store.ts` — store in-memory + funções de cálculo 🟢
- `products-store.ts` — `product.slug` como FK lógica 🟢
- `alerts-data.ts` — consome `getPromotions()`, `getPromotionStatus()`, `daysRemaining()` 🟢
- `mock-data.ts` — `Product` type para `describeProductWithPromo` 🟢
- Backend API (futuro) — CRUD real + `promotion_performance` tracking 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Consistência | Taxa snapshotada na venda — não retroage | blueprints + ADR | 🟡 |
| Performance | Status calculado em tempo real — O(1) por promoção | `promotions-store.ts:106` | 🟢 |
| Disponibilidade | Store in-memory — perde estado no reload | `promotions-store.ts:38` | 🟢 |
| Segurança | CRUD restrito a Admin — 🔴 sem RBAC real atualmente | ADR-002 | 🔴 |
| Precisão temporal | endDate ajustado para 23:59:59.999 — evita expiração prematura | `promotions-store.ts:109` | 🟢 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Status calculado
Dado que promoção tem startDate = ontem, endDate = amanhã, enabled = true
Quando getPromotionStatus é chamado
Então retorna "Active"

# Happy path — Status Upcoming
Dado que promoção tem startDate = amanhã, enabled = true
Quando getPromotionStatus é chamado
Então retorna "Upcoming"

# Happy path — Disabled ignora datas
Dado que promoção tem datas válidas mas enabled = false
Quando getPromotionStatus é chamado
Então retorna "Disabled"

# Happy path — resolveEffectiveRate sem boost
Dado que promoção tem commissionRateOverride = 50, performanceEnabled = false
Quando resolveEffectiveRate é chamado
Então retorna 50

# Happy path — Performance Boost atingido
Dado que promoção tem performanceEnabled = true, performanceMinSales = 5
E performanceRateIfReached = 60, performanceRateIfNotReached = 40
Quando afiliado tem 5 vendas na campanha
Então resolveEffectiveRate retorna 60

# Happy path — Performance Boost não atingido
Dado mesma promoção acima
Quando afiliado tem 4 vendas na campanha
Então resolveEffectiveRate retorna 40

# Falha — Produto sem promoção ativa
Dado que nenhuma promoção está ativa para "schaikron"
Quando getActivePromotionForProduct("schaikron") é chamado
Então retorna undefined → comissão usa taxa base do produto

# Borda — endDate no último segundo do dia
Dado que endDate = "2026-06-08" e now = "2026-06-08T23:59:58"
Quando getPromotionStatus é chamado
Então retorna "Active" (endDate ajustado para 23:59:59.999)

# Borda — endDate = "2026-06-08" e now = "2026-06-09T00:00:00"
Quando getPromotionStatus é chamado
Então retorna "Expired"
```

---

## Cenários de Borda (detalhado)

1. **Duas promoções ativas para o mesmo produto:** `getActivePromotionForProduct` retorna a primeira no array — sem critério de desempate definido. Necessário: unicidade de promoção ativa por produto via constraint de banco ou validação no CRUD.

2. **Performance Boost retroativo:** Afiliado faz 4 vendas com taxa "not reached" (40%) e 5ª venda eleva para threshold. Política atual: prospectiva apenas (5ª venda e seguintes ganham 60%). Se retroativa: 4 comissões anteriores precisariam ser recalculadas. Esta decisão de produto está em aberto (🔴 ADR necessário).

3. **Fuso horário na expiração:** `endDate` é string `"yyyy-mm-dd"`. `new Date("2026-06-08")` em ambiente UTC retorna `2026-06-08T00:00:00Z`. Ajuste para `23:59:59.999` é feito em UTC. Afiliados em UTC-3 veriam expiração às 20:59 horário local. Usar `timestamptz` no banco com timezone explícito.

4. **Promoção criada com startDate no passado:** Promoção nasce já `Active`. Válido para retroatividade intencional, mas pode gerar comissões com taxa incorreta em vendas históricas se processadas em batch posterior.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| `getPromotionStatus` | Must | Base de toda decisão de campanha |
| `resolveEffectiveRate` | Must | Cálculo de comissão depende disso |
| `getActivePromotionForProduct` | Must | Consumido no webhook de compra |
| CRUD admin (upsert/toggle) | Must | Único meio de gerenciar campanhas |
| `timeRemaining` / countdown UI | Should | UX de urgência — não bloqueia negócio |
| `maxAchievableRate` | Should | Copy "earn up to X%" — impacto em conversão |
| Performance Boost | Should | Diferencial competitivo — não obrigatório no MVP |
| Persistência real (banco) | Must | 🔴 in-memory perde dados no reload |
| Unicidade de promoção ativa por produto | Should | Previne comportamento não-determinístico |
| Política retroativa de boost | Could | Decisão de produto — não urgente |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/promotions-store.ts` | `Promotion`, `getPromotionStatus`, `resolveEffectiveRate`, `getActivePromotionForProduct`, `resolvePromoDurationMonths`, `daysRemaining`, `timeRemaining`, `maxAchievableRate`, `upsertPromotion`, `togglePromotion`, `usePromotions` | 🟢 |
| `src/routes/promotions.tsx` | `PromotionsPage` | 🟡 não lido diretamente |
| `src/components/promo-countdown.tsx` | `PromoCountdown` | 🟡 não lido diretamente |
| `src/components/guided-promotion-dialog.tsx` | `GuidedPromotionDialog` | 🟡 não lido diretamente |
| `src/lib/alerts-data.ts` | consome `getPromotions`, `getPromotionStatus`, `daysRemaining` | 🟢 |
