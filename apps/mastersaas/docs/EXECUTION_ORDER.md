# MasterSaaS — Ordem de Execução
> Criado: 2026-06-09 | Baseado na análise Reversa v1.2.14
> Atualizar ao iniciar e concluir cada módulo.

---

## Princípio de ordenação

Cada módulo depende dos anteriores. Nunca pular etapas — especialmente as de schema, pois as FKs bloqueiam as migrations seguintes.

---

## Fase 1 — Fundação (bloqueante para tudo)

### M01 — Schema SQL completo `mastersaas.*`
**Status:** 🔴 não iniciado
**Dependências:** nenhuma
**Entregável:** arquivo de migration com todas as tabelas do schema
**Critério de conclusão:** `npx prisma db execute` sem erros; tabelas visíveis no Supabase

### M02 — Estender `profiles` com campos de pagamento
**Status:** 🔴 não iniciado
**Dependências:** M01
**Entregável:** migration `ALTER TABLE profiles ADD COLUMN pix_key, bank_*, payment_type`
**Critério de conclusão:** campos visíveis no Supabase Dashboard

---

## Fase 2 — Catálogo e Campanhas

### M03 — Products CRUD (backend)
**Status:** 🔴 não iniciado
**Dependências:** M01
**Entregável:** endpoints `GET/POST /products`, `PATCH /products/:slug`
**Critério de conclusão:** produto Evolia cadastrado e acessível via API

### M04 — Promotions CRUD (backend)
**Status:** 🔴 não iniciado
**Dependências:** M03
**Entregável:** endpoints `GET/POST /promotions`, `PATCH /promotions/:id`
**Critério de conclusão:** campanha criada e `getActivePromotionForProduct` funcionando via API

---

## Fase 3 — Entrada de Receita (coração do sistema)

### M05 — Rota `/r/:code/:slug` (referral redirect)
**Status:** 🔴 não iniciado — **CRÍTICO**
**Dependências:** M03
**Entregável:** rota server-side que registra clique, persiste cookie 14d, redireciona para Evolia com `src=MASTERSAAS|AFIL|{code}|{productCode}`
**Critério de conclusão:** link de afiliado rastreado e redirect funcionando end-to-end

### M06 — Webhook de vendas (Stripe + AppMax → `mastersaas.sales`)
**Status:** 🔴 não iniciado — **CRÍTICO**
**Dependências:** M01, M03, M04
**Entregável:** endpoint `POST /webhooks/stripe` e `POST /webhooks/appmax` que criam `mastersaas.sales`
**Critério de conclusão:** venda de teste no Evolia aparece em `mastersaas.sales`

---

## Fase 4 — Motor de Comissões

### M07 — Comissões diretas (criação no webhook)
**Status:** 🔴 não iniciado — **CRÍTICO**
**Dependências:** M06
**Entregável:** após inserir `sale`, criar `commission` (type='direct') em `pending` + `commission_history`
**Critério de conclusão:** venda de teste gera comissão com `hold_until = sale_date + 30d`

### M08 — Comissões de rede (coafiliação)
**Status:** 🔴 não iniciado
**Dependências:** M07
**Entregável:** ao criar comissão direta, verificar `referred_by_id` → se elegível, criar `commission` (type='network', parent_commission_id)
**Critério de conclusão:** venda de coafiliado gera comissão de rede para recrutador elegível

### M09 — CRON pg_cron (liberação diária)
**Status:** 🔴 não iniciado — **CRÍTICO**
**Dependências:** M07
**Entregável:** job pg_cron às 03:00 UTC que transiciona `pending → available` com `hold_until < NOW()`
**Critério de conclusão:** job rodando no Supabase; comissões liberadas após 30 dias

---

## Fase 5 — Saques e Financeiro

### M10 — Withdrawals (saque do afiliado)
**Status:** 🔴 não iniciado
**Dependências:** M07, M09
**Entregável:** `POST /me/withdrawals` com idempotência, validação server-side, snapshot de dados bancários
**Critério de conclusão:** saque criado, saldo bloqueado, admin consegue aprovar e marcar como pago

### M11 — Finance Affiliate (painel de saldo)
**Status:** 🟡 mock (localStorage)
**Dependências:** M07, M10
**Entregável:** `GET /me/balance`, `GET /me/transactions` substituindo mocks
**Critério de conclusão:** afiliado vê saldo real sem dados em localStorage

### M12 — Finance Admin (visão global + batch pay)
**Status:** 🟡 mock (1.710 LOC — analisar antes)
**Dependências:** M10
**Entregável:** `GET /admin/commissions`, `GET /admin/withdrawals`, `POST /admin/payout-batches`
**Critério de conclusão:** admin consegue aprovar saques em lote com SELECT FOR UPDATE SKIP LOCKED

---

## Fase 6 — Rede e Rastreamento

### M13 — Network settings e campanhas (backend)
**Status:** 🟡 mock in-memory
**Dependências:** M08
**Entregável:** CRUD `network_settings` e `network_campaigns`, endpoint `GET /network/rules/resolved`
**Critério de conclusão:** admin altera taxa de rede e próxima comissão usa nova taxa

### M14 — Painel de rede (afiliado)
**Status:** 🟡 mock
**Dependências:** M13
**Entregável:** `GET /me/referrals` com métricas reais, export CSV
**Critério de conclusão:** afiliado vê seus indicados com earnings reais

---

## Fase 7 — Conteúdo e Alertas

### M15 — Tutorials e News (backend)
**Status:** 🟡 mock localStorage
**Dependências:** M01
**Entregável:** CRUD `tutorials` e `news`, progresso por afiliado em `tutorial_progress`
**Critério de conclusão:** admin cadastra tutorial e afiliado vê em `/tutorials`

### M16 — Smart Alerts (queries SQL)
**Status:** 🟡 funções puras (sem backend)
**Dependências:** M07, M09, M10
**Entregável:** `GET /alerts?scope=` derivando alertas de queries reais
**Critério de conclusão:** alerta de "saldo disponível" aparece com valor real

---

## Fase 8 — Notificações e Segurança

### M17 — WhatsApp Integration (mover token para backend)
**Status:** 🔴 token em localStorage — risco de segurança
**Dependências:** M01
**Entregável:** token Evolution API em variável de ambiente; templates em `whatsapp_templates`; proxy Fastify para chamadas
**Critério de conclusão:** token removido do frontend; notificação enviada ao afiliado no evento `commission_available`

---

## Resumo de progresso

| Fase | Módulos | Concluídos | % |
|------|---------|-----------|---|
| 1 — Fundação | M01, M02 | 0 | 0% |
| 2 — Catálogo | M03, M04 | 0 | 0% |
| 3 — Entrada de receita | M05, M06 | 0 | 0% |
| 4 — Comissões | M07, M08, M09 | 0 | 0% |
| 5 — Saques e Financeiro | M10, M11, M12 | 0 | 0% |
| 6 — Rede | M13, M14 | 0 | 0% |
| 7 — Conteúdo e Alertas | M15, M16 | 0 | 0% |
| 8 — Notificações | M17 | 0 | 0% |
| **Total** | **17** | **0** | **0%** |

> Frontend Lovable existe (protótipo navegável) — não conta como módulo backend concluído.
> Auth/Supabase real existe para `profiles` — será estendido em M02, não reescrito.
