# Smart Alerts — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Sistema de alertas proativos derivados do dataset em tempo real. Analisa vendas, promoções, comissões e afiliados para gerar notificações inteligentes sem configuração manual. Hoje opera como funções puras client-side sobre mock-data — em produção deve ser substituído por views materializadas ou edge functions que alimentam a tabela `notifications`.

---

## Responsabilidades

- Detectar spikes e quedas de receita comparando períodos 🟢
- Identificar afiliado top com concentração de receita 🟢
- Alertar sobre campanhas expirando em breve 🟢
- Detectar campanhas de alto desempenho 🟢
- Notificar sobre comissões disponíveis para saque 🟢
- Alertar admin sobre afiliados com aprovações pendentes 🟢
- Filtrar alertas por escopo para exibição contextual por página 🟢
- Ordenar alertas por severidade e data 🟢

---

## Interface

### Tipos

```typescript
type AlertSeverity = "info" | "success" | "warning" | "danger"
type AlertScope    = "global" | "campaigns" | "finance" | "reports"

type SmartAlert = {
  id: string           // determinístico — ex: "alert-sales-spike"
  scope: AlertScope
  severity: AlertSeverity
  title: string
  description: string
  action?: { label: string; to: string }  // deep-link interno
  icon: LucideIcon
  createdAt: string    // ISO date — data da última venda do dataset
}
```

### Funções

```typescript
generateAlerts(): SmartAlert[]
// Funções puras — sem side effects
// Consome: mockAdminSales, mockAdminAffiliates, mockFinance, getPromotions()

alertsForScope(scope: AlertScope): SmartAlert[]
// Filtra generateAlerts() por scope

// Estilos por severidade (constante UI)
SEVERITY_STYLES: Record<AlertSeverity, { dot, iconWrap, badge }>
```

### Algoritmos internos

```typescript
// Divisão de período em duas metades
sortedDates = completed.map(s => s.date).sort()
totalDays   = daysBetween(first, last) + 1
half        = floor(totalDays / 2)
midDate     = first + half dias
recent      = completed.filter(s => s.date >= midISO)
prior       = completed.filter(s => s.date < midISO)

// Delta de receita
delta = ((recentRev - priorRev) / priorRev) * 100

// Concentração de afiliado
share = (topAff.revenue / recentRev) * 100
```

---

## Regras de Negócio

- Alertas são gerados como funções puras — sem efeitos colaterais, sem estado 🟢
- IDs de alertas são determinísticos — mesmos dados sempre geram mesmo ID 🟢
- Se `completed.length === 0`: retorna array vazio sem processar 🟢
- **Sales spike:** `delta >= +15%` → severity `success`; `delta <= -15%` → severity `danger` 🟢
- **Top affiliate:** `share >= 25%` da receita recente → severity `info` 🟢
- **Campaign ending:** promoção `Active` com `daysRemaining <= 3` → severity `warning` 🟢
- **Campaign strong:** promoção `Active` com `>= 3 vendas` no período recente → severity `success` 🟢
- **Campaign upcoming:** promoção com status `Upcoming` → severity `info` 🟢
- **Payout available:** `availableBalance >= 100` → severity `success` 🟢
- **Pending commissions:** `pendingBalance > 0` → severity `info` 🟢
- **Pending approvals:** afiliados com `status === "pending"` → severity `warning` 🟢
- Ordenação: `danger(0) → warning(1) → success(2) → info(3)` — depois data desc 🟢
- Em produção: deve ser view materializada ou edge function — não client-side 🔴
- `alertsForScope` é filtro simples sobre `generateAlerts()` 🟢

---

## Fluxo Principal — generateAlerts()

```
1. Filtra vendas completed = mockAdminSales.filter(s => s.status === 'completed')
2. Se vazio → retorna []
3. Ordena datas, calcula midDate, separa recent vs prior
4. Calcula recentRev e priorRev

5. SPIKE/DROP (se priorRev > 0):
   delta = (recentRev - priorRev) / priorRev * 100
   if delta >= 15  → push alert-sales-spike (success)
   if delta <= -15 → push alert-conversion-drop (danger)

6. TOP AFFILIATE:
   agrupa recent por affiliateId → topAff
   if topAff.share >= 25% → push alert-top-affiliate (info)

7. CAMPAIGNS:
   para cada promoção:
     if Active AND daysRemaining <= 3 → push alert-campaign-ending (warning)
     if Active AND campaignSales.length >= 3 → push alert-campaign-strong (success)
     if Upcoming → push alert-campaign-upcoming (info)

8. PAYOUT:
   if availableBalance >= 100 → push alert-payout-available (success)
   if pendingBalance > 0 → push alert-payout-pending (info)

9. ADMIN APPROVALS:
   pendingAffs = mockAdminAffiliates.filter(a => a.status === 'pending').length
   if pendingAffs > 0 → push alert-pending-approvals (warning)

10. Ordena por sevWeight, depois createdAt desc
11. Retorna alerts[]
```

---

## Fluxos Alternativos

- **Sem vendas no período:** `completed.length === 0` → retorna `[]` imediatamente 🟢
- **Só uma venda (prior vazio):** `priorRev = 0` → spike/drop não calculado (divisão por zero evitada) 🟢
- **Múltiplas campanhas ativas:** cada uma gera seus próprios alertas independentemente 🟢
- **Afiliado top com share < 25%:** alerta não gerado — threshold não atingido 🟢
- **`availableBalance < 100`:** alerta de payout não gerado 🟢

---

## Dependências

- `admin-sales-data.ts` — `mockAdminSales` como fonte de vendas 🟢
- `admin-finance-data.ts` — `mockAdminAffiliates` para pending approvals 🟢
- `mock-data.ts` — `mockFinance` para payout alerts, `formatCurrency` 🟢
- `promotions-store.ts` — `getPromotions()`, `getPromotionStatus()`, `daysRemaining()` 🟢
- `notifications` tabela (futuro) — persistência de alertas server-side 🔴
- Views materializadas (futuro) — `mv_revenue_daily`, `mv_top_affiliates_30d` 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Performance | Funções puras — O(n) sobre dataset, sem I/O | `alerts-data.ts` | 🟢 |
| Consistência | IDs determinísticos — mesmos dados = mesmos alertas | `alerts-data.ts` | 🟢 |
| Escalabilidade | Client-side não escala >5k vendas — migrar para view materializada | blueprints | 🟡 |
| Disponibilidade | Sem estado — pode ser recalculado a qualquer momento | `alerts-data.ts` | 🟢 |
| Atualização | Em produção: CRON de refresh das views materializadas | blueprints | 🔴 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Sales spike detectado
Dado que recentRev = R$1150 e priorRev = R$1000
Quando generateAlerts é chamado
Então delta = 15% → alert-sales-spike com severity="success" é gerado
E action aponta para "/admin/reports"

# Happy path — Revenue drop detectado
Dado que recentRev = R$800 e priorRev = R$1000
Quando generateAlerts é chamado
Então delta = -20% → alert-conversion-drop com severity="danger" é gerado

# Happy path — Top affiliate concentração
Dado que afiliado VAN01 gerou 30% da receita recente
Quando generateAlerts é chamado
Então alert-top-affiliate com title="VAN01 is leading" é gerado com severity="info"

# Happy path — Campaign ending
Dado que promoção "Black Friday Boost" está Active com 2 dias restantes
Quando generateAlerts é chamado
Então alert-campaign-ending-promo-1 com severity="warning" é gerado
E description menciona "2 days"

# Happy path — Ordenação por severidade
Dado que existem alertas de severity: info, danger, warning, success
Quando generateAlerts é chamado
Então retorna na ordem: danger, warning, success, info

# Falha — Sem vendas completed
Dado que mockAdminSales não tem vendas com status="completed"
Quando generateAlerts é chamado
Então retorna array vazio []

# Falha — priorRev = 0 (só uma venda)
Dado que há apenas uma venda (prior está vazio, priorRev = 0)
Quando generateAlerts é chamado
Então spike/drop NÃO é calculado (evita divisão por zero)
E outros alertas continuam sendo processados normalmente

# Borda — Mesmo alert ID para mesmo dataset
Dado que generateAlerts é chamado duas vezes com mesmo dataset
Quando comparados os resultados
Então IDs são idênticos — comportamento determinístico
```

---

## Cenários de Borda (detalhado)

1. **Escala com >5k vendas client-side:** `generateAlerts()` itera sobre todo `mockAdminSales` para calcular períodos, agrupar por afiliado e detectar spikes. Com 5k+ registros, isso pode bloquear a thread principal por dezenas de ms. Migração obrigatória para view materializada com CRON de refresh periódico.

2. **Período muito curto (1-2 vendas):** Com apenas 2 vendas, `midDate = first + 0 dias` pode fazer `prior = []` e `recent = [ambas]`. Threshold de `priorRev > 0` evita divisão por zero, mas o alerta de spike pode ser gerado artificialmente. Sugestão: mínimo de 5 vendas para calcular spike/drop.

3. **Múltiplas campanhas para o mesmo produto expirando:** Se produto "schaikron" tem 2 campanhas ativas expirando em 3 dias, 2 alertas são gerados com IDs diferentes (`alert-campaign-ending-promo-1` e `alert-campaign-ending-promo-2`). UI pode ficar sobrecarregada com muitos alertas do mesmo tipo. Considerar agrupamento.

4. **Alert de payout com threshold fixo de R$100:** Threshold `availableBalance >= 100` é hardcoded em `alerts-data.ts`. Em produção com afiliados de alto volume, R$100 pode gerar alertas excessivamente frequentes. Tornar threshold configurável por admin ou por afiliado.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| `generateAlerts` como funções puras | Must | Base de toda notificação do sistema |
| Spike/drop de receita | Must | Sinal de saúde do negócio |
| Campaign ending alert | Must | Afeta ação imediata de afiliados |
| `alertsForScope` filtro | Must | Exibição contextual por página |
| Top affiliate alert | Should | Informação operacional útil |
| Pending approvals alert | Should | Admin precisa agir |
| Migração para view materializada | Should | Escalabilidade — não urgente no MVP |
| Payout available alert | Could | Conveniência — afiliado já vê no Finance |
| Threshold configurável | Could | Personalização para afiliados de alto volume |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/alerts-data.ts` | `SmartAlert`, `AlertSeverity`, `AlertScope`, `generateAlerts`, `alertsForScope`, `SEVERITY_STYLES` | 🟢 |
| `src/lib/admin-sales-data.ts` | fonte de `mockAdminSales` | 🟡 não lido diretamente |
| `src/lib/admin-finance-data.ts` | `mockAdminAffiliates` | 🟢 |
| `src/lib/mock-data.ts` | `mockFinance`, `formatCurrency` | 🟢 |
| `src/lib/promotions-store.ts` | `getPromotions`, `getPromotionStatus`, `daysRemaining` | 🟢 |
| `src/components/notifications-bell.tsx` | consome `generateAlerts()` | 🟡 não lido diretamente |
| `src/components/contextual-alerts.tsx` | consome `alertsForScope()` | 🟡 não lido diretamente |
| `src/components/insights-alerts-section.tsx` | consome `generateAlerts()` | 🟡 não lido diretamente |
| Backend notifications table | — | 🔴 não existe |
| View materializada mv_revenue_daily | — | 🔴 não existe |
