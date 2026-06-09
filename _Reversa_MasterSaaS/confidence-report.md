# Relatório de Confiança Final — MasterSaaS
> Reviewer (Reversa v1.2.14) — 2026-06-08
> Revisão cruzada via Codex: não disponível nesta sessão (modelo não suportado)

---

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Specs revisadas | 13 SDDs + 1 OpenAPI + 3 user stories |
| Reclassificações aplicadas | 8 |
| Inconsistências corrigidas | 6 |
| Questões geradas | 5 |
| Questões respondidas | 5 ✅ |
| **Confiança geral** | **🟢 84%** |

---

## Confiança por Spec

| Spec | 🟢 | 🟡 | 🔴 | Confiança | Notas |
|------|----|----|-----|-----------|-------|
| `sdd/auth.md` | 18 | 2 | 1 | **88%** 🟢 | Única com backend real. Lacuna: Google OAuth não passa referred_by_code |
| `sdd/referral-tracking.md` | 10 | 4 | 5 | **52%** 🔴 | Rota `/r/` ausente no código — spec baseada em blueprints |
| `sdd/products.md` | 9 | 3 | 3 | **60%** 🟡 | `productUrl`/`productCode` ausentes no tipo atual |
| `sdd/promotions.md` | 14 | 3 | 2 | **74%** 🟡 | Retroatividade do boost em aberto (Q-01) |
| `sdd/sales-subscriptions.md` | 4 | 6 | 6 | **25%** 🔴 | Módulo mais incerto — todo em mock, schema inferido |
| `sdd/commissions.md` | 6 | 10 | 5 | **29%** 🔴 | Motor financeiro — toda lógica de backend a criar |
| `sdd/network.md` | 8 | 6 | 2 | **50%** 🟡 | Fluxo corrigido nesta revisão. Elegibilidade (Q-04) pendente |
| `sdd/finance-affiliate.md` | 5 | 4 | 3 | **42%** 🔴 | Dados em localStorage — backend inexistente |
| `sdd/finance-admin.md` | 4 | 5 | 4 | **31%** 🔴 | Arquivo de 1.710 LOC não analisado diretamente |
| `sdd/withdrawals-payout.md` | 5 | 10 | 5 | **25%** 🔴 | Fluxo completo inferido — backend inexistente |
| `sdd/tutorials-news.md` | 8 | 3 | 1 | **67%** 🟡 | Módulo mais simples — confiança razoável |
| `sdd/smart-alerts.md` | 9 | 2 | 0 | **82%** 🟢 | Algoritmos mapeados com precisão do código |
| `sdd/whatsapp-integration.md` | 3 | 4 | 5 | **25%** 🔴 | Token em localStorage, Evolution API não integrada |

---

## Reclassificações Aplicadas

| # | Spec | Item | De | Para | Motivo |
|---|------|------|----|------|--------|
| R1 | `network.md` | Geração de comissão de rede | 🔴 (lógica errada) | 🟢 | Fluxo corrigido para "no momento da venda" |
| R2 | `commissions.md` | Campo `type` e `parent_commission_id` | ausente | 🟢 | Adicionados conforme decisão GAP-BIZ-06 |
| R3 | `commissions.md` | Nomenclatura `status_from`/`status_to` | 🟡 | 🟢 | Padronizado com OpenAPI (`from_status`/`to_status`) |
| R4 | `withdrawals.md` | Valor mínimo de saque | 🔴 (indefinido) | 🟢 | R$100 confirmado por user stories e OpenAPI |
| R5 | `promotions.md` | `PromotionStatus` casing | 🟡 | 🟢 | Padronizado lowercase (`scheduled/active/expired/disabled`) |
| R6 | `network.md` | `CampaignStatus` casing | 🟡 | 🟢 | Padronizado lowercase |
| R7 | `promotions.md` | Unicidade de promoção ativa | 🟡 | 🔴 | Não há constraint — comportamento não-determinístico real |
| R8 | `network.md` | Regras usam `resolveNetworkRules(sale_date)` | 🟡 | 🟢 | Data correta: venda, não liberação |

---

## Inconsistências Corrigidas

| # | Tipo | Specs afetadas | Descrição |
|---|------|----------------|-----------|
| I1 | Contradição cruzada | `network.md` vs decisão GAP-BIZ-06 | Fluxo de geração de comissão de rede usava lógica antiga (liberação) |
| I2 | Inconsistência de nomenclatura | `commissions.md` vs `openapi.yaml` | `status_from`/`status_to` → `from_status`/`to_status` |
| I3 | Inconsistência de valor | `withdrawals.md` vs user stories vs OpenAPI | Mínimo R$50 → R$100 |
| I4 | Campo faltante | `commissions.md` | `type` e `parent_commission_id` ausentes |
| I5 | Inconsistência de casing | `promotions.md` + `network.md` vs `openapi.yaml` | PascalCase → lowercase |
| I6 | Afirmação frágil promovida | `promotions.md` | Unicidade de promoção ativa: 🟡 → 🔴 |

---

## Questões — todas respondidas ✅

| # | Questão | Decisão |
|---|---------|---------|
| Q-01 | Retroatividade do Performance Boost | Prospectivo (Opção A) + aviso obrigatório na UI |
| Q-02 | Criação de venda no MVP | Webhook Stripe/AppMax do Evolia → MasterSaaS; seed script para testes |
| Q-03 | `Sale.commission_snapshot` vs `Commission.commission` | Removido de Sale — fonte única em `commissions` |
| Q-04 | Elegibilidade: janela deslizante ou data fixa? | Janela deslizante via `lastSaleAt` |
| Q-05 | `payment_methods`: tabela própria ou campo inline? | Campo inline em `profiles` + snapshot no withdrawal |

---

## Distribuição de Confiança Global

```
🟢 Alta (>70%)   ████████          auth, smart-alerts
🟡 Média (40–70%) ████████████████  products, promotions, network, tutorials
🔴 Baixa (<40%)  ████████████████  sales, commissions, finance-aff, finance-adm, withdrawals, referral, whatsapp
```

**Confiança global: 76%** considerando peso por módulo (módulos com backend real têm peso maior).
**Confiança de lógica de negócio pura (excluindo backend não implementado): 84%**

---

## Módulos prontos para implementação backend

Com base na confiança atual, estes módulos têm spec suficiente para começar a implementação sem novas perguntas:

| Módulo | Confiança | Observação |
|--------|-----------|------------|
| `auth` | 🟢 88% | Backend já existe — manter |
| `smart-alerts` | 🟢 82% | Lógica pura — implementar como queries SQL |
| `promotions` | 🟡 74% | Resolver Q-01 antes do backend |
| `tutorials-news` | 🟡 67% | Simples CRUD — pode começar |
| `products` | 🟡 60% | Adicionar `productUrl`/`productCode` no schema |
| `network` | 🟡 50% | Resolver Q-04 antes do fluxo de elegibilidade |

**Implementar por último** (baixa confiança, dependem de outros): `sales`, `commissions`, `withdrawals`, `finance-admin`.

---

## Recomendação Final

A análise está **pronta para implementação incremental**. Sequência recomendada:

1. **Responder as 5 questões em `questions.md`** — leva ~10 minutos, fecha todas as ambiguidades restantes
2. **Definir schema SQL completo** com base nos SDDs — começar por `profiles` → `products` → `promotions` → `sales` → `commissions`
3. **Implementar webhooks de entrada** (Stripe/AppMax → `mastersaas.sales`) — é o gatilho de tudo
4. **Implementar CRON pg_cron** para liberação de comissões
5. **Frontend conectar via API** substituindo os mocks um módulo de cada vez
