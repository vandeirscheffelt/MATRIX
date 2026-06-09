# Spec Impact Matrix — MasterSaaS
> Arquiteto (Reversa v1.2.14) — 2026-06-08
> Leitura: linha impacta coluna (✅ = impacto direto | 🟡 = impacto indireto | — = sem impacto)

---

## Matriz de Impacto entre Componentes

| Componente \ Afeta → | Auth | Products | Promotions | Sales | Commissions | Network | Finance | Withdrawals | Tutorials | Smart Alerts | WhatsApp |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Auth / Profiles** | — | 🟡 | 🟡 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ |
| **User Roles (RBAC)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | ✅ |
| **Products** | — | — | ✅ | ✅ | ✅ | — | 🟡 | — | — | 🟡 | — |
| **Promotions** | — | 🟡 | — | ✅ | ✅ | 🟡 | 🟡 | — | — | ✅ | 🟡 |
| **Affiliate Tracking (clicks)** | — | — | — | ✅ | 🟡 | — | — | — | — | 🟡 | — |
| **Referral Attribution** | ✅ | — | — | ✅ | ✅ | ✅ | 🟡 | — | — | — | 🟡 |
| **Sales / Subscriptions** | — | 🟡 | 🟡 | — | ✅ | ✅ | ✅ | 🟡 | — | ✅ | 🟡 |
| **Commission Engine** | — | — | 🟡 | 🟡 | — | ✅ | ✅ | ✅ | — | ✅ | ✅ |
| **Network Rules** | — | — | 🟡 | 🟡 | ✅ | — | 🟡 | — | — | 🟡 | 🟡 |
| **Finance (Affiliate)** | 🟡 | — | — | — | ✅ | — | — | ✅ | — | ✅ | — |
| **Withdrawals / Payout** | — | — | — | — | ✅ | — | ✅ | — | — | ✅ | ✅ |
| **CRON Jobs** | — | — | ✅ | ✅ | ✅ | — | ✅ | — | — | 🟡 | — |
| **Webhook Handler (Stripe)** | — | — | 🟡 | ✅ | ✅ | — | 🟡 | 🟡 | — | 🟡 | — |
| **Tutorials** | 🟡 | — | — | — | — | — | — | — | — | 🟡 | 🟡 |
| **News** | — | — | 🟡 | — | — | 🟡 | — | — | 🟡 | — | — |
| **Smart Alerts** | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | 🟡 | — | — | 🟡 |
| **WhatsApp Integration** | — | — | — | — | — | — | — | 🟡 | 🟡 | — | — |

---

## Análise de Impacto por Mudança Crítica

### Se mudar o schema de `commissions.status`
Impacta: Finance Admin (UI), Finance Affiliate (UI), Withdrawals, Commission History, Smart Alerts, Outbound Webhooks, CRON Jobs
**Risco:** ALTO — mudança breaking em múltiplos módulos

### Se implementar RBAC (user_roles)
Impacta: TODOS os módulos — cada rota e tabela precisa de RLS atualizado
**Risco:** ALTO — mas é o primeiro passo obrigatório

### Se migrar products de localStorage para banco
Impacta: Products, Promotions, Sales, Commissions, Affiliate Links, Admin Products CRUD
**Risco:** MÉDIO — mudança isolada, CRUD já existe na UI

### Se implementar tracking de cliques server-side
Impacta: Referral Tracking, Affiliate Attribution, Smart Alerts, Reports
**Risco:** BAIXO — adição, não breaking change

### Se implementar CRON de release de comissão
Impacta: Commission Engine, Finance (Affiliate), Finance Admin, Smart Alerts
**Risco:** BAIXO — substitui useEffect frágil, mesmo comportamento esperado

---

## Tabelas com Maior Fan-out (mais dependentes)

| Tabela | Dependentes diretos |
|--------|---------------------|
| `profiles` | user_roles, payment_methods, clicks, referral_attributions, sales, subscriptions, commissions, referral_commissions, withdrawals, payout_batches, whatsapp_integrations |
| `commissions` | commission_history, referral_commissions, withdrawals (via saldo), payout_batches, smart_alerts |
| `products` | product_prices, sales_copy_translations, promotions, sales, subscriptions, clicks |
| `sales` | commissions, subscription_events, smart_alerts, reports |
