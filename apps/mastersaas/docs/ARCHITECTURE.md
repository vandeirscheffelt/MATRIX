# MasterSaaS — Architecture
> Criado: 2026-06-09 | Fonte: Reversa v1.2.14 (análise completa — confiança 84%)
> Atualizar a cada módulo concluído.

---

## Visão Geral

Portal de afiliados do ecossistema Shaikron. Gerencia o ciclo completo de coafiliação: cadastro de afiliados, rastreamento de vendas, cálculo e pagamento de comissões, rede de coafiliados e capacitação.

**Produto vendido:** Evolia (`app.shaikron.scheffelt.xyz`)
**Fluxo de venda:** LIADS → lead → Evolia (checkout AppMax/Stripe) → webhook → MasterSaaS registra venda e distribui comissões

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + TanStack Router + Tailwind + shadcn/ui (Lovable) |
| Backend | Fastify + TypeScript (`apps/api/`) |
| Banco | PostgreSQL via Supabase — schema `mastersaas.*` |
| Auth | Supabase Auth + trigger `handle_new_user` |
| CRON | pg_cron (Supabase) — liberação diária de comissões às 03:00 UTC |
| Notificações | n8n + Evolution API (WhatsApp) |
| Pagamentos entrada | Stripe + AppMax (via Evolia) |
| Pagamentos saída | Manual PIX (MVP) → Asaas (futuro) |
| Deploy | Docker + Nginx (VPS Speedfy) |

---

## Domínio

`mastersaas.scheffelt.xyz`

---

## Módulos e Status

| # | Módulo | Descrição | Status |
|---|--------|-----------|--------|
| 1 | **Auth / Profiles** | Cadastro, OTP, Google OAuth, affiliate_code, referred_by_id | ✅ Backend real (Supabase) |
| 2 | **Referral Tracking** | Links `/r/:code/:slug` e `/join/:code`, cookie 14d, atribuição | 🔴 Rota `/r/` ausente |
| 3 | **Products** | Catálogo multi-currency, commissionRate, productUrl/Code | 🟡 Mock localStorage |
| 4 | **Promotions** | Campanhas com override de taxa e Performance Boost prospectivo | 🟡 Mock in-memory |
| 5 | **Sales** | Webhook Stripe/AppMax → `mastersaas.sales` | 🔴 Não implementado |
| 6 | **Commissions** | Ciclo pending→available→paid, holding 30d, CRON pg_cron | 🔴 Mock in-memory |
| 7 | **Network** | Coafiliação 1 nível, elegibilidade janela deslizante, campanhas | 🟡 Mock in-memory |
| 8 | **Finance Affiliate** | Saldo, extrato, dados bancários inline em profiles | 🔴 PII em localStorage |
| 9 | **Finance Admin** | Visão global comissões, batch pay, relatórios | 🟡 Mock (1710 LOC) |
| 10 | **Withdrawals** | Saque PIX (mín R$100), idempotência, snapshot de dados bancários | 🔴 Não implementado |
| 11 | **Tutorials / News** | Conteúdo de capacitação por categoria, progresso | 🟡 Mock localStorage |
| 12 | **Smart Alerts** | Alertas proativos derivados de dados (spikes, campaigns, saldo) | 🟡 Funções puras — sem backend |
| 13 | **WhatsApp** | Templates de notificação via Evolution API | 🔴 Token em localStorage — risco |

---

## Banco de Dados — Schema `mastersaas.*`

Tabelas a criar (ordem de dependência):

```
profiles (já existe em public — estender com campos de pagamento)
  └─ mastersaas.products
       └─ mastersaas.promotions
            └─ mastersaas.sales
                 └─ mastersaas.commissions
                      └─ mastersaas.commission_history
                           └─ mastersaas.withdrawals
mastersaas.network_settings
mastersaas.network_campaigns
mastersaas.tutorials
mastersaas.news
mastersaas.whatsapp_templates
mastersaas.payout_batches
```

### Campos críticos confirmados

**profiles** (estender):
- `pix_key TEXT` — chave PIX do afiliado
- `bank_name TEXT`, `bank_agency TEXT`, `bank_account TEXT`
- `payment_type TEXT` — pix | bank | wise

**mastersaas.sales**:
- `id UUID PK`
- `affiliate_id UUID FK profiles`
- `product_id TEXT FK products.slug`
- `campaign_id UUID FK promotions` (snapshot)
- `customer_email_hash TEXT` — SHA-256, nunca PII em texto
- `phone TEXT` — capturado pelo LIADS no checkout
- `revenue NUMERIC`
- `currency TEXT` — BRL | USD | …
- `gateway TEXT` — stripe | appmax
- `external_payment_id TEXT UNIQUE`
- `source TEXT` — MASTERSAAS|AFIL|{code}|{productCode}
- `status TEXT` — completed | pending | refunded
- `created_at TIMESTAMPTZ`

**mastersaas.commissions**:
- `type TEXT` — direct | network
- `parent_commission_id UUID FK commissions` — preenchido quando type = network
- `from_status / to_status` em commission_history (não status_from/status_to)

---

## Regras de Negócio Críticas

1. `affiliate_code` — imutável após criação, gerado pelo trigger `handle_new_user`
2. `referred_by_id` — imutável após primeiro set; vínculo permanente de coafiliação
3. Comissão nasce sempre em `pending`, holding 30 dias antes de liberar para saque
4. Comissão de rede: gerada no momento da VENDA (não da liberação), mesmo holding
5. Performance Boost — **prospectivo**: apenas vendas a partir do threshold ganham taxa maior. UI deve avisar explicitamente.
6. Elegibilidade de rede: janela deslizante via `lastSaleAt` (não query COUNT)
7. Saque mínimo: R$100; dados bancários inline em `profiles`; snapshot copiado para `withdrawal`
8. CRON pg_cron às 03:00 UTC: `UPDATE commissions SET status='available' WHERE status='pending' AND hold_until < NOW()`
9. `Sale` não guarda `commission_snapshot` — fonte única de verdade é `commissions`
10. Links de afiliado: `/r/{code}/{productSlug}` — rota server-side obrigatória

---

## Integrações Externas

| Sistema | Papel | Status |
|---------|-------|--------|
| Stripe | Recebimento venda Evolia (internacional) | ✅ Configurado no Evolia |
| AppMax | Recebimento venda Evolia (Brasil) | ✅ Configurado no Evolia |
| Evolution API | Notificações WhatsApp via n8n | 🟡 n8n configurado, templates pendentes |
| LIADS | Envia lead para Evolia com parâmetro `src` | 🔴 Em construção |
| pg_cron | CRON de liberação de comissões | 🔴 A implementar |
| Asaas | PIX programático para saques (futuro) | ⏳ Planejado pós-MVP |

---

## Decisões Arquiteturais Registradas

| ADR | Decisão |
|-----|---------|
| ADR-001 | First-click attribution — primeiro indicador registrado; imutável |
| ADR-002 | CRUD de promoções exclusivo do Admin |
| ADR-003 | localStorage como backend temporário (migrar urgente) |
| ADR-004 | CommissionStatus renomeado vs frontend mock (usar schema backend) |
| ADR-005 | Supabase Auth only — sem auth próprio |
| ADR-006 | Multi-currency pricing via mapa `prices: Record<CurrencyCode, number>` |
| ADR-007 | Performance Boost prospectivo — sem retroatividade (2026-06-09) |
| ADR-008 | `Sale` sem `commission_snapshot` — fonte única em `commissions` (2026-06-09) |
| ADR-009 | `payment_methods` inline em `profiles` — um método por afiliado no MVP (2026-06-09) |
| ADR-010 | Comissão de rede gerada no momento da venda, não da liberação (2026-06-09) |
