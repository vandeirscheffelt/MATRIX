# Network (Rede de Afiliados) — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Módulo responsável pela rede de coafiliação. Um afiliado pode recrutar coafiliados por dois caminhos: (1) link `/join/:code` compartilhado para qualquer pessoa; (2) cliente que comprou via link de afiliado e posteriormente se tornou vendedor — nesse caso o `referred_by_id` já está registrado da compra original. O recrutador recebe 5% das comissões geradas pelo coafiliado, desde que esteja elegível. Gerencia regras de elegibilidade configuráveis e campanhas de recrutamento com taxas temporárias. Estrutura de 1 nível atual.

> **Decisão confirmada (2026-06-08):** comissão de rede é gerada no momento da venda do coafiliado com status `pending`. Fica visível no painel mas bloqueada para saque durante 30 dias (mesmo holding da comissão direta). CRON diário libera ambas simultaneamente.

---

## Responsabilidades

- Persistir vínculo permanente entre indicador e indicado (`referred_by_id`) 🟢
- Calcular elegibilidade do indicador para receber comissão de rede 🟢
- Resolver regras de rede ativas (base vs campanha de recrutamento) 🟢
- Calcular comissão de rede sobre comissão do indicado 🟡
- Gerar `referral_commission` no momento da venda do indicado, com status `pending` (holding 30 dias) 🟢
- Expor métricas da rede para o afiliado (vendas, earnings, indicados ativos) 🟡
- Suportar campanhas de recrutamento com taxas e elegibilidade temporárias 🟢
- Exportar lista de indicados em CSV 🟡

---

## Interface

### Tipos

```typescript
type NetworkSettings = {
  enabled: boolean
  defaultRatePct: number      // default: 5 (%)
  eligibilityDays: number     // default: 30
  minSalesRequired: number    // default: 1
}

type NetworkCampaign = {
  id: string
  name: string
  startDate: string           // ISO yyyy-mm-dd
  endDate: string
  ratePctOverride?: number
  eligibilityDaysOverride?: number
  minSalesOverride?: number
  enabled: boolean
}

type CampaignStatus = "active" | "scheduled" | "expired" | "disabled"
// ⚠️ padronizado para lowercase — consistente com PromotionStatus

type ResolvedNetworkRules = {
  ratePct: number
  eligibilityDays: number
  minSales: number
  fromCampaign?: NetworkCampaign   // se overrideado por campanha
}

type ReferredAffiliate = {
  id: string
  code: string                     // affiliate_code do indicado
  joinedAt: string
  salesThisMonth: number
  totalSales: number
  earningsGenerated: number        // lifetime earnings do indicador sobre este indicado
  earningsThisMonth: number
  lastSaleAt: string | null
}

type Recruiter = {
  rank: number
  code: string
  referrals: number
  networkRevenue: number
}
```

### Funções principais

```typescript
// Regras resolvidas (base + override de campanha ativa)
resolveNetworkRules(now?: Date): ResolvedNetworkRules

// Elegibilidade do afiliado para receber comissão de rede
isReferralEligible(
  lastPersonalSaleAt: string | null,
  rules: ResolvedNetworkRules,
  recentSalesCount?: number   // default: 1
): boolean

// Campanha de recrutamento ativa
getActiveNetworkCampaign(now?: Date): NetworkCampaign | undefined

// Status calculado de campanha
getCampaignStatus(c: NetworkCampaign, now?: Date): CampaignStatus

// Totais da rede
getNetworkTotals(refs: ReferredAffiliate[]): {
  monthEarnings, lifetimeEarnings, monthSales, totalReferrals, activeReferrals
}

// Link de convite
buildReferralLink(code?: string): string
// retorna: "https://mastersaas.scheffelt.xyz/join/{code}"

// CRUD de campanhas (admin)
upsertNetworkCampaign(c: NetworkCampaign): void
toggleNetworkCampaign(id: string): void
deleteNetworkCampaign(id: string): void
setNetworkSettings(next: NetworkSettings): void
```

---

## Regras de Negócio

- Rede atual: 1 nível apenas — indicador recebe sobre vendas diretas dos indicados 🟢
- `REFERRAL_RATE = 0.05` (5%) é a constante base — aplicada sobre `commission`, não sobre `revenue` 🟢
- `resolveNetworkRules` usa campanha ativa para override parcial: apenas campos definidos sobrescrevem 🟢
- `isReferralEligible` usa **janela deslizante** — verifica se há ao menos `minSales` vendas nos últimos `eligibilityDays` dias contados a partir de hoje 🟢 *(decisão confirmada 2026-06-08)*
  - `lastPersonalSaleAt = null` → `false` 🟢
  - `recentSalesCount < rules.minSales` → `false` 🟢
  - `daysSinceLastSale > rules.eligibilityDays` → `false` (equivalente: `lastSaleAt < now() - eligibilityDays`) 🟢
  - caso contrário → `true` 🟢
  - Implementação: usar `lastSaleAt` em vez de query COUNT — mais simples e já presente no código 🟢
- Se inelegível: comissão de rede não é creditada (sem retroatividade quando elegibilidade é restaurada) 🟡
- `referred_by_id` é imutável após set — vínculo permanente, independente de elegibilidade 🟢
- Comissão de rede calculada: `referral_commission = parent_commission.commission × ratePct / 100` 🟢
- Comissão de rede gerada no mesmo momento que a comissão do indicado é liberada (available) 🟡
- Campanha de recrutamento não afeta comissões de venda — só afeta regras de elegibilidade e taxa de rede 🟢
- Cascade de comissões em multinível deve ser limitado a profundidade máxima (hoje: 1 nível) 🟡
- `endDate` de campanha tratado como `23:59:59.999` — consistente com promoções 🟢
- Settings são singleton — apenas um registro em `network_settings` 🟡

---

## Fluxo Principal — Resolução de Regras de Rede

1. `resolveNetworkRules(now)`
2. Carrega `settings` base (defaultRatePct=5, eligibilityDays=30, minSalesRequired=1)
3. `getActiveNetworkCampaign(now)` → busca campanha com status "Active"
4. Se campanha ativa existe:
   - `ratePct = camp.ratePctOverride ?? base.ratePct`
   - `eligibilityDays = camp.eligibilityDaysOverride ?? base.eligibilityDays`
   - `minSales = camp.minSalesOverride ?? base.minSales`
   - `fromCampaign = camp`
5. Retorna `ResolvedNetworkRules`

## Fluxo Principal — Geração de Comissão de Rede

> **Decisão confirmada (2026-06-08):** gerada no momento da VENDA, não da liberação.

1. Webhook de compra registra `mastersaas.sales` (afiliado = indicado)
2. Verifica se `indicado.referred_by_id` está definido no perfil
3. Carrega perfil do indicador
4. `resolveNetworkRules(sale_date)` — usa data da venda
5. `isReferralEligible(indicador.lastSaleAt, rules, recentSalesCount)`
6. Se elegível:
   - Calcula `commission_base` do indicado: `revenue × effectiveRate / 100`
   - `amount = commission_base × rules.ratePct / 100`
   - INSERT `commissions` com `type = 'network'`, `status = 'pending'`, `parent_commission_id = commission_base.id`, `hold_until = sale_date + 30d`
   - INSERT `commission_history` para rastreabilidade
7. Se inelegível: nenhuma comissão gerada — sem retroatividade
8. CRON diário libera ambas (direta + rede) simultaneamente quando `hold_until < NOW()`

## Fluxo Principal — Painel de Rede (Afiliado)

1. Afiliado acessa `/network`
2. `GET /api/me/referrals` → lista de `ReferredAffiliate`
3. Exibe: taxa atual, banner de campanha ativa, badge de elegibilidade
4. Tabela de indicados com metrics, busca, paginação client-side
5. Botão CSV export: gera arquivo com dados da tabela atual
6. Modal de detalhes por indicado

---

## Fluxos Alternativos

- **Indicador inelegível no momento da liberação:** comissão de rede não gerada — vínculo permanece para vendas futuras 🟡
- **Campanha de recrutamento expira durante período de elegibilidade:** `resolveNetworkRules` usa data da liberação — se campanha expirou, usa regras base 🟢
- **Dois indicados do mesmo indicador vendem simultaneamente:** gerações de `referral_commission` são independentes e idempotentes por `commission_id` 🟡
- **Sem campanha ativa:** `getActiveNetworkCampaign` retorna `undefined` → usa `settings` base 🟢
- **Settings com `enabled = false`:** comissões de rede não são geradas — verificar antes de processar 🟡
- **Indicado cancela assinatura:** comissões de rede históricas preservadas; futuras não geradas 🟡

---

## Dependências

- `network-settings-store.ts` — CRUD de settings e campanhas 🟢
- `network-data.ts` — `ReferredAffiliate`, `REFERRAL_RATE`, `mockReferrals`, `buildReferralLink` 🟢
- `referral-storage.ts` — captura de ref_code → `referred_by_id` 🟢
- `commissions` module — `referral_commission` criada após liberação da comissão base 🔴
- `profiles` — `referred_by_id` FK permanente 🟢
- Backend API (futuro) — `GET /api/me/referrals`, `GET /api/network/rules`, `GET /api/me/eligibility` 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Consistência | referral_commission gerada atomicamente com liberação da comissão base | blueprints | 🟡 |
| Escalabilidade | Multinível futuro requer closure table ou ltree — limitar profundidade agora | blueprints | 🟡 |
| Segurança | CRUD de settings restrito a Admin | permissions.md | 🟡 |
| Rastreabilidade | referred_by_id imutável — auditoria de atribuição de rede | migration SQL | 🟢 |
| Performance | Para rede grande: CTE recursiva com profundidade máxima | blueprints | 🟡 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Elegibilidade ativa
Dado que afiliado tem lastPersonalSaleAt = há 15 dias
E regras: eligibilityDays = 30, minSalesRequired = 1, recentSalesCount = 1
Quando isReferralEligible é chamado
Então retorna true

# Happy path — Inelegível por tempo
Dado que afiliado tem lastPersonalSaleAt = há 35 dias
E regras: eligibilityDays = 30
Quando isReferralEligible é chamado
Então retorna false

# Happy path — Inelegível sem vendas
Dado que afiliado não tem vendas (lastPersonalSaleAt = null)
Quando isReferralEligible é chamado
Então retorna false

# Happy path — Override por campanha
Dado que campanha "Recruitment Boost" está ativa com ratePctOverride = 10
Quando resolveNetworkRules é chamado
Então retorna ratePct = 10 com fromCampaign preenchido

# Happy path — Comissão de rede gerada
Dado que indicado JOA21 gerou comissão de R$14.70
E indicador VAN01 é elegível
E ratePct = 5%
Quando comissão de JOA21 é liberada
Então referral_commission criada para VAN01 com amount = 0.735 (14.70 × 5%)

# Falha — Inelegível no momento da liberação
Dado que indicador não tem vendas nos últimos 30 dias
Quando comissão do indicado é liberada
Então referral_commission NÃO é gerada
E nenhuma notificação de perda de elegibilidade é enviada ao indicador

# Borda — Settings disabled
Dado que network_settings.enabled = false
Quando comissão do indicado é liberada
Então referral_commission NÃO é gerada para ninguém

# Borda — Campanha expirada no momento da liberação
Dado que campanha com ratePct = 10% expirou ontem
E comissão do indicado foi gerada durante a campanha mas liberada hoje
Quando referral_commission é calculada
Então usa ratePct = 5% (regras base) — não congela taxa da época da venda
```

---

## Cenários de Borda (detalhado)

1. **Profundidade multinível futura:** Hoje: indicador recebe sobre indicado (nível 1). Se no futuro indicador recebe também sobre sub-indicados (nível 2+), necessário `closure_table` ou `ltree` no banco para evitar N+1 queries recursivas. Limitar profundidade máxima a 3 níveis por design.

2. **Indicador perde e recupera elegibilidade:** Afiliado tem venda em Jan, fica inelegível em Fev (sem vendas), volta a vender em Mar. Comissões de rede de Fev são perdidas permanentemente — sem retroatividade. UI deve mostrar claramente o status de elegibilidade e o prazo restante.

3. **Dois afiliados indicando o mesmo lead:** Impossível por design — `referred_by_id` é imutável após o primeiro set. Apenas o primeiro indicador que convenceu o lead a se cadastrar recebe. First-referral wins.

4. **Taxa de comissão de rede vs taxa de comissão de venda divergentes:** `referral_commission.amount = commission.commission × ratePct / 100`. Se `commission.commission` foi calculada com promoção (taxa 50%), a comissão de rede também é maior. Isso é intencional — indicador ganha proporcionalmente ao sucesso do indicado.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| `isReferralEligible` | Must | Gate para geração de comissão de rede |
| `resolveNetworkRules` | Must | Base de toda decisão de rede |
| `referral_commission` gerada na liberação | Must | Modelo de negócio da rede |
| `referred_by_id` permanente no banco | Must | Já implementado — manter |
| CRUD de NetworkSettings (admin) | Must | Configuração operacional |
| Campanhas de recrutamento | Should | Boost de crescimento de rede |
| Painel de rede (afiliado) | Should | Visibilidade do indicador |
| CSV export | Could | Raramente usado — não bloqueia negócio |
| Multinível (nível 2+) | Won't | Fora do escopo atual — planejar apenas |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/network-settings-store.ts` | `NetworkSettings`, `NetworkCampaign`, `resolveNetworkRules`, `isReferralEligible`, `getActiveNetworkCampaign`, `getCampaignStatus`, `upsertNetworkCampaign`, `toggleNetworkCampaign`, `deleteNetworkCampaign` | 🟢 |
| `src/lib/network-data.ts` | `ReferredAffiliate`, `REFERRAL_RATE`, `mockReferrals`, `buildReferralLink`, `getNetworkTotals`, `isEligibleForReferralEarnings` | 🟢 |
| `src/routes/network.tsx` | `NetworkPage` | 🟡 não lido diretamente |
| `src/routes/admin.network.tsx` | `AdminNetworkPage` | 🟡 não lido diretamente |
| Backend referral_commissions engine | — | 🔴 não existe |
