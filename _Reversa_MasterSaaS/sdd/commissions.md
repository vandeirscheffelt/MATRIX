# Commissions — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Motor financeiro central do MasterSaaS. Gerencia o ciclo de vida completo de uma comissão desde sua criação (status `pending`) até o pagamento final (`paid`), passando por uma janela obrigatória de holding de 30 dias. Toda mudança de status é auditada com trilha imutável. Hoje operando em mock in-memory — é o módulo de maior impacto e risco da implementação backend.

> **Decisão confirmada (2026-06-08):** comissões de rede (coafiliação) seguem o mesmo ciclo e mesma tabela. Criadas no momento da venda com `pending`, visíveis no painel do recrutador, liberadas pelo CRON diário após 30 dias. Schema único: `mastersaas.*`.

---

## Responsabilidades

- Criar comissão ao registrar uma venda, com snapshot imutável de taxa e valor 🟢
- Aplicar janela de holding de 30 dias antes de liberar para saque 🟡
- Transicionar `pending → available` via CRON diário (não via client-side) 🔴
- Registrar trilha de auditoria imutável em `commission_history` para toda mudança de status 🟡
- Calcular saldo disponível e pendente do afiliado 🟡
- Bloquear transições de status inválidas 🟡
- Suportar reversão contábil em caso de reembolso pós-pagamento 🟡
- Expor histórico de comissões com filtros para Admin e Afiliado 🟡

---

## Interface

### Tipo `Commission`

```typescript
type Commission = {
  id: string                      // uuid
  sale_id: string                 // uuid FK sales
  affiliate_id: string            // uuid FK profiles
  campaign_id?: string            // uuid FK promotions (snapshot)
  revenue: number                 // receita bruta da venda
  commission: number              // valor calculado (revenue × rate / 100)
  rate_snapshot: number           // taxa % no momento da venda — imutável
  type: "direct" | "network"     // direct = comissão de venda; network = comissão de coafiliação
  parent_commission_id?: string   // uuid FK commissions — preenchido apenas quando type = 'network'
  sale_date: string               // ISO timestamptz
  hold_until: string              // sale_date + 30 dias
  available_at?: string           // quando virou available
  paid_at?: string
  canceled_at?: string
  payment_id?: string             // ID do payout provider
  status: CommissionStatus
  created_at: string
}

type CommissionStatus =
  | "pending"      // aguardando holding de 30 dias
  | "available"    // liberado para saque
  | "processing"   // aprovado pelo admin, pagamento em andamento
  | "paid"         // pago — terminal
  | "canceled"     // cancelado — terminal
  | "failed"       // falha no pagamento — pode retry
  | "refunded"     // estornado — terminal
```

### Tipo `CommissionHistory` (audit log)

```typescript
type CommissionHistory = {
  id: string
  commission_id: string    // FK commissions
  from_status: CommissionStatus   // padronizado com OpenAPI
  to_status: CommissionStatus     // padronizado com OpenAPI
  note?: string            // obrigatório em transições manuais pelo admin
  actor_id: string         // uuid do admin ou sistema
  ip?: string
  ua?: string
  created_at: string       // append-only
}
```

### Tipo `AdminAffiliate` (frontend atual)

```typescript
type CommissionStatus = "pending" | "approved" | "paid" | "partially_paid" | "reversed"
// ⚠️ diverge do schema backend — usar schema backend em produção
```

### Cálculo de saldo

```typescript
availableBalance = Σ commissions WHERE status = "available" AND affiliate_id = me
                 - Σ withdrawals WHERE status IN ("processing","paid") AND affiliate_id = me
// (simplificado — versão exata requer reconciliação)

pendingBalance = Σ commissions WHERE status = "pending" AND affiliate_id = me
totalEarned    = Σ commissions WHERE status NOT IN ("canceled","refunded") AND affiliate_id = me
totalWithdrawn = Σ withdrawals WHERE status = "paid" AND affiliate_id = me
```

---

## Regras de Negócio

- `rate_snapshot` e `commission` são imutáveis após criação — alterações no produto não retroagem 🟢
- Comissão nasce sempre em `pending` — nunca em outro status 🟢
- `hold_until = sale_date + 30 dias` — transição para `available` só após esse timestamp 🟡
- Transição `pending → available` deve ser feita por CRON diário (00:05 UTC) — não por client-side 🔴
- Transições inválidas devem ser bloqueadas no banco: `paid → *`, `refunded → *`, `canceled → paid` 🟡
- Toda mudança de status manual exige `note` preenchida + `actor_id` registrado 🟡
- Reembolso pós-pagamento cria `commission_reversal` — não altera a comissão original 🟡
- `commission_history` é append-only — nunca UPDATE ou DELETE 🟡
- Admin pode fazer override manual de status com justificativa 🟡
- `partially_paid` do frontend não tem equivalente no backend — consolidar como sequência de `paid` parciais 🔴
- Status `failed` permite retry: admin resubmete para `processing` 🟡
- Saldo de afiliado nunca pode ficar negativo após saque — validação no momento do saque 🟡

---

## Máquina de Estado

```
pending ──(CRON hold_until < now)──> available ──(admin batch)──> processing ──(webhook payout)──> paid ✓
   │                                     │                               │
   │                                     │                               └──(webhook failed)──> failed
   │                                     │                               └──(admin)──> canceled ✓
   │                                     └──(admin)──> canceled ✓
   └──(admin)──> canceled ✓
   └──(charge.refunded antes do hold)──> refunded ✓

paid ──(reembolso pós-payout)──> [cria commission_reversal, não altera paid]
```

Transições inválidas (bloquear via CHECK constraint ou trigger):
- `paid → qualquer`
- `refunded → qualquer`
- `canceled → paid`

---

## Fluxo Principal — CRON de Release Diário

1. CRON executa às 00:05 UTC todos os dias
2. `UPDATE commissions SET status = 'available', available_at = now() WHERE status = 'pending' AND hold_until < now()`
3. Para cada comissão liberada: INSERT em `commission_history` (sistema como actor)
4. Emite `commission.available` para n8n (notifica afiliado)
5. Log de quantas comissões foram liberadas

## Fluxo Principal — Aprovação em Lote (Admin)

1. Admin filtra comissões com status `available` em `/admin/finance`
2. Seleciona até 50 itens (SELECTION_LIMIT)
3. Clica "Pagar selecionadas" → dialog de confirmação com total
4. Backend: `SELECT commissions WHERE id IN (...) AND status = 'available' FOR UPDATE SKIP LOCKED`
5. UPDATE em transação: `status = 'processing'`
6. INSERT em `payout_batches` com total e item_count
7. INSERT em `commission_history` para cada item (actor = admin)
8. Dispara pagamento via provedor (PIX/Stripe Connect)
9. Webhook de confirmação → UPDATE `status = 'paid'`, `paid_at = now()`

## Fluxo Alternativo — Override Manual de Status (Admin)

1. Admin abre modal de status na comissão
2. Seleciona novo status + preenche nota obrigatória
3. Backend valida transição permitida
4. UPDATE commission.status
5. INSERT commission_history com note + actor_id + ip + ua

---

## Fluxos Alternativos

- **Dois admins clicando "Pagar" simultaneamente:** `SELECT FOR UPDATE SKIP LOCKED` — segundo admin não pega itens já bloqueados 🟡
- **Webhook de payout falhou:** UPDATE status = 'failed'; admin pode resubmeter para 'processing' 🟡
- **Comissão cancelada pelo admin:** INSERT history + UPDATE status = 'canceled'; terminal 🟡
- **Reembolso antes do holding:** `charge.refunded` → UPDATE status = 'refunded' + canceled_at 🟡
- **Reembolso após pagamento:** cria `commission_reversal` com débito futuro; comissão original permanece `paid` 🟡

---

## Dependências

- `admin-finance-data.ts` — mock de `AdminAffiliate`, `CommissionStatus` (frontend) 🟢
- `sales` module — `sale_id` FK obrigatório 🔴
- `profiles` — `affiliate_id` FK 🟢
- `promotions` — `campaign_id` snapshot opcional 🟡
- `withdrawals` — consome `availableBalance` calculado 🔴
- CRON (pg_cron ou n8n) — release diário 🔴
- Payout provider (PIX/Stripe Connect) — webhook de confirmação 🔴
- n8n — notificações de eventos de comissão 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Consistência | Transação atômica no batch pay — SELECT FOR UPDATE SKIP LOCKED | blueprints | 🟡 |
| Auditabilidade | commission_history append-only — nunca DELETE/UPDATE | blueprints | 🟡 |
| Idempotência | Webhook de payout com event_id para dedupe | blueprints | 🟡 |
| Performance | CRON release: UPDATE em lote, não row-by-row | blueprints | 🟡 |
| Segurança | Apenas admin pode fazer override de status | ADR-002 + permissions.md | 🟡 |
| Rastreabilidade | actor_id + ip + ua em toda mudança manual | `admin-finance-data.ts` | 🟢 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Criação de comissão
Dado que venda de R$49 foi atribuída ao afiliado VAN01 (rate 30%)
Quando venda é registrada
Então commission criada com commission = 14.70, status = "pending"
E hold_until = sale_date + 30 dias
E commission_history registra criação com actor = sistema

# Happy path — Release pelo CRON
Dado que comissão está pending com hold_until = ontem
Quando CRON de 00:05 UTC executa
Então commission.status = "available", available_at = now()
E commission_history registra transição pending → available

# Happy path — Batch pay sem race condition
Dado que dois admins tentam pagar o mesmo conjunto de comissões simultaneamente
Quando ambos submetem o batch
Então SELECT FOR UPDATE SKIP LOCKED garante que cada comissão é processada apenas uma vez
E segundo admin recebe conjunto vazio ou parcial

# Happy path — Override manual com nota
Dado que admin deseja cancelar uma comissão pending
Quando preenche nota "Cliente solicitou cancelamento" e confirma
Então commission.status = "canceled", canceled_at = now()
E commission_history registra: status_from = "pending", status_to = "canceled", note = "Cliente...", actor_id = admin

# Falha — Transição inválida
Dado que comissão está em status "paid"
Quando admin tenta mover para "pending"
Então sistema rejeita com erro "transição inválida"
E commission_history não é alterado

# Falha — Reembolso pós-payout
Dado que comissão está em status "paid"
Quando Stripe envia charge.refunded
Então comissão original permanece "paid"
E cria-se commission_reversal com débito equivalente
E saldo do afiliado é reduzido na próxima reconciliação

# Borda — CRON não roda por falha de infra
Dado que CRON falhou por 2 dias
Quando CRON executa novamente
Então todas as comissões com hold_until < now() são liberadas em batch único
E nenhuma comissão é perdida (WHERE clause captura todas pendentes)
```

---

## Cenários de Borda (detalhado)

1. **Fuso horário no hold_until:** `sale_date` em UTC-3 às 23:00 local = 02:00 UTC do dia seguinte. Se CRON roda às 00:05 UTC, comissão com `hold_until` desse dia pode ser liberada 1 hora após a meia-noite local. Usar `timestamptz` consistente em todo o sistema.

2. **Afiliado com saldo negativo após reversal:** Se comissão foi paga, afiliado sacou, e depois houve reembolso — `commission_reversal` cria débito. Próximo saque: `availableBalance = Σ available - Σ reversals`. Garantir que saldo nunca cai abaixo de zero no momento do saque.

3. **SELECTION_LIMIT = 50 e 51 comissões disponíveis:** A 51ª fica para o próximo batch. Admin deve processar em múltiplas rodadas. Sem prioridade definida sobre qual fica — ordenar por `available_at ASC` para FIFO.

4. **Comissão em `processing` sem resposta do provedor:** Timeout indefinido — status trava em `processing`. Necessário: CRON de reconciliação semanal que detecta `processing` com `updated_at > 7 dias` e notifica admin para reprocessamento manual.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Criação de commission no webhook | Must | Sem isso nenhum afiliado recebe |
| rate_snapshot imutável | Must | Integridade financeira core |
| CRON release pending → available | Must | Atualmente em useEffect — 🔴 crítico migrar |
| commission_history append-only | Must | Auditoria regulatória |
| SELECT FOR UPDATE SKIP LOCKED | Must | Race condition destrói financeiro |
| Bloquear transições inválidas | Must | Consistência do ciclo de vida |
| Override manual com nota | Should | Flexibilidade operacional para admin |
| commission_reversal pós-payout | Should | Necessário para integridade mas raro |
| Reconciliação semanal | Should | Detecta travamentos em processing |
| Notificações via n8n | Could | UX — não bloqueia financeiro |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/admin-finance-data.ts` | `CommissionStatus`, `AdminAffiliate`, `AffiliateSale`, `PaymentRecord`, `mockAdminAffiliates` | 🟢 |
| `src/lib/mock-data.ts` | `mockFinance`, `mockTransactions`, `FinanceTransaction` | 🟢 |
| `src/routes/admin.finance.tsx` | `AdminFinancePage` (1710 LOC) | 🟡 não lido diretamente |
| `src/routes/finance.tsx` | `FinancePage` | 🟡 não lido diretamente |
| Backend commission engine | — | 🔴 não existe |
| CRON release job | — | 🔴 não existe |
| commission_history trigger | — | 🔴 não existe |
