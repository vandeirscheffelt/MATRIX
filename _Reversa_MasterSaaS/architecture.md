# Architecture — MasterSaaS
> Gerado pelo Arquiteto (Reversa v1.2.14) — 2026-06-08
> 🟢 CONFIRMADO | 🟡 INFERIDO | 🔴 LACUNA

---

## Visão Geral

O MasterSaaS é uma **plataforma white-label de gestão de afiliados** para produtos SaaS do ecossistema Schaikron. Atua como camada de atribuição, comissões, rede de indicação, conteúdo e integrações operacionais — sem hospedar os produtos finais.

**Estado atual:** Frontend funcional com backend quase inexistente. Apenas Auth + `profiles` estão materializados. Todo o restante opera em mock/localStorage.

**Destino:** Backend Fastify no monorepo Matrix (`apps/api/`) integrando ao mesmo Supabase do ecossistema Shaikron.

---

## Stack

| Camada | Tecnologia | Status |
|--------|-----------|--------|
| Frontend | TanStack Start v1 + React 19 + Vite 7 | ✅ Funcionando |
| Roteamento | TanStack Router file-based | ✅ Funcionando |
| UI | Tailwind v4 + shadcn/ui + Radix UI | ✅ Funcionando |
| Auth | Supabase Auth + Lovable Cloud wrapper | ✅ Funcionando |
| Banco (real) | Supabase PostgreSQL — apenas `profiles` | ✅ Parcial |
| Banco (necessário) | Supabase PostgreSQL — 20+ tabelas | 🔴 Não criado |
| Backend API | Fastify (Matrix monorepo) | 🔴 Não iniciado |
| Deploy atual | Cloudflare Workers (wrangler.jsonc) | 🟡 Configurado |
| Deploy target | VPS Speedfy + Docker (padrão Matrix) | 🔴 A migrar |

---

## Princípios Arquiteturais Identificados

1. **Frontend desacoplado de backend** — UI modelou o domínio completo antes do backend existir
2. **localStorage como staging area** — dados migram para banco real módulo a módulo
3. **Supabase Auth como fonte de verdade de identidade** — não replicar lógica de auth
4. **Snapshot de comissão imutável** — taxa snapshotada no momento da venda
5. **First-click attribution** — afiliação não sobrescreve após primeiro registro
6. **Estado calculado, nunca armazenado** — status de promoção e campanha são derivados

---

## Módulos e suas Dependências

```
Auth ──────────────────────────────────────┐
  ↓                                         │
Referral Tracking ────────────────────────┐ │
  ↓                                       ↓ ↓
Products ←── Promotions ←── Network ←── Dashboard
  ↓              ↓              ↓
Sales ←──────────┘         Finance (Affiliate)
  ↓
Commissions ────────────────────────────────
  ↓                   ↓
Finance (Admin) ←── Network Commissions
  ↓
Withdrawals / Payout Batches
  ↓
Tutorials ←── Tutorial Progress ←── Smart Alerts
News ─────────────────────────────────────────┘
WhatsApp Integration (Admin)
```

---

## Dívidas Técnicas

| # | Dívida | Severidade | Módulo |
|---|--------|-----------|--------|
| DT-01 | PII financeira em localStorage sem criptografia | 🔴 CRÍTICO | Finance |
| DT-02 | Token WhatsApp em localStorage | 🔴 CRÍTICO | WhatsApp |
| DT-03 | RBAC inexistente — admin routes abertas | 🔴 CRÍTICO | Auth/Global |
| DT-04 | Tracking de cliques inexistente server-side | 🔴 ALTO | Referral |
| DT-05 | Release de comissão em useEffect (client-only) | 🔴 ALTO | Finance Admin |
| DT-06 | Rota `/r/:userId/:slug` ausente ou não encontrada | 🟡 MÉDIO | Referral |
| DT-07 | `setAffiliateParent` (cookie 14d) não encontrado | 🟡 MÉDIO | Referral |
| DT-08 | `getFxRateFromBRL()` estático — valores desatualizados | 🟡 MÉDIO | i18n/Currency |
| DT-09 | Status de comissão diverge entre frontend e blueprint | 🟡 MÉDIO | Finance |
| DT-10 | `types.ts` Supabase desatualizado (só profiles) | 🟡 MÉDIO | DB Types |
| DT-11 | Zero testes automatizados | 🟡 MÉDIO | Global |
| DT-12 | SSR server snapshot retorna mockProducts | 🟡 BAIXO | Products |
| DT-13 | Sidebar admin visível para todos sem RBAC visual | 🟡 BAIXO | UI |

---

## Ordem de Implementação Recomendada (Backend)

### Fase 1 — Segurança (imediato)
1. `user_roles` + `has_role()` + RLS por papel
2. Guards de rota `_authenticated/` e `_admin/`
3. `payment_methods` criptografado — migrar do localStorage
4. `whatsapp_integrations` com token criptografado

### Fase 2 — Persistência administrativa
5. `products` + `product_prices` + `sales_copy_translations`
6. `promotions` + `promotion_performance`
7. `network_settings` + `network_campaigns`
8. `tutorials` + `tutorial_translations` + `tutorial_progress`
9. `news` + `news_translations`

### Fase 3 — Tracking e conversão
10. `clicks` + `POST /api/track/click`
11. Redirect server-side `/api/r/:userId/:slug`
12. Webhook Stripe → `sales` + `commissions`

### Fase 4 — Motor financeiro
13. `commissions` + `commission_history` + CRON release
14. `withdrawals` + `payout_batches`
15. `audit_logs`

### Fase 5 — Recorrência e rede
16. `subscriptions` + `subscription_events` + CRON recorrente
17. `referral_attributions` + `referral_commissions`

### Fase 6 — Notificações e integrações
18. `notifications` + outbound webhooks
19. n8n triggers por evento
20. WhatsApp real (Meta ou Evolution)

### Fase 7 — Analytics
21. Views materializadas (`mv_revenue_daily`, `mv_top_affiliates_30d`)
22. Exports server-side para volumes > 5k registros
