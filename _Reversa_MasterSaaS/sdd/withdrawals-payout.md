# Withdrawals & Payout — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Módulo responsável pelo ciclo de vida completo dos saques de afiliados — desde a solicitação até a confirmação de pagamento. Opera em coordenação com o Finance Admin para aprovação e processamento em lote. Integra com provedores externos (PIX, Stripe Connect) via webhooks. É o módulo com maior risco financeiro direto: erros aqui resultam em pagamentos duplicados, não pagos ou enviados para o destinatário errado.

---

## Responsabilidades

- Criar solicitação de saque com idempotência garantida 🟡
- Validar saldo disponível no momento do saque (server-side) 🟡
- Gerenciar lifecycle: `requested → processing → paid/failed/canceled` 🟡
- Agrupar saques em `payout_batches` para rastreabilidade 🟡
- Confirmar pagamento via webhook do provedor 🔴
- Registrar auditoria em `commission_history` (ou `withdrawal_history`) para cada transição 🟡
- Notificar afiliado ao pagamento confirmado via n8n 🔴
- Reconciliar periodicamente withdrawals vs payout_batches 🔴

---

## Interface

### Tipo `Withdrawal`

```typescript
type Withdrawal = {
  id: string                    // uuid
  affiliate_id: string          // uuid FK profiles
  amount: number                // valor solicitado
  currency: string              // "BRL" (default)
  status: WithdrawalStatus
  requested_at: string          // ISO timestamptz
  processed_at?: string
  paid_at?: string
  payment_method_snapshot: object // snapshot dos dados bancários no momento do saque (pix_key/bank_*)
  payment_id?: string           // ID externo do provedor
  notes?: string                // notas do admin
  batch_id?: string             // FK payout_batches
  idempotency_key: string       // UK — gerado client-side
}

type WithdrawalStatus =
  | "requested"    // aguardando aprovação admin
  | "processing"   // aprovado, pagamento em andamento
  | "paid"         // pago — terminal
  | "canceled"     // cancelado — terminal
  | "failed"       // falha — pode retry

type PayoutBatch = {
  id: string
  created_by_admin_id: string  // FK profiles
  total_amount: number
  currency: string
  item_count: number
  status: "created" | "processing" | "finalized"
  created_at: string
  finalized_at?: string
}
```

### Endpoints

```typescript
// Afiliado
POST /api/me/withdrawals
// body: { amount: number, payment_method_id: string, idempotency_key: string }
// Valida: amount >= min, amount <= availableBalance, payment_method existe e pertence ao afiliado

GET /api/me/withdrawals?status&from&to&page
// Lista saques do afiliado autenticado

// Admin
GET /api/admin/withdrawals?affiliate_id&status&from&to&batch_id&page
PUT /api/admin/withdrawals/:id/status
// body: { status: WithdrawalStatus, note: string }

POST /api/admin/payout-batches
// body: { withdrawal_ids: string[] }  — máx SELECTION_LIMIT=50
// Cria batch + move withdrawals para processing

// Webhook público (provedor)
POST /api/public/webhook/payout
// Confirma paid ou failed via HMAC
```

---

## Regras de Negócio

- `idempotency_key` único por `(affiliate_id, key)` — previne duplicatas por duplo clique 🟡
- Validação de saldo é obrigatoriamente server-side — client não é fonte de verdade 🟡
- `amount >= minWithdrawal` — valor mínimo: **R$100** 🟢 (confirmado nas user stories e OpenAPI)
- `amount <= availableBalance` calculado em tempo real no momento do INSERT 🟡
- Dados bancários armazenados inline no perfil (`profiles.pix_key`, `profiles.bank_*`) — um método por afiliado 🟢 *(decisão confirmada 2026-06-09)*
- No momento do saque, snapshot dos dados é copiado para `withdrawal.payment_method_snapshot` — garante auditoria mesmo se afiliado alterar dados depois 🟢
- Batch limitado a `SELECTION_LIMIT = 50` itens por execução 🟡
- Transições válidas:
  - `requested → processing` (admin aprova)
  - `requested → canceled` (admin ou afiliado cancela)
  - `processing → paid` (webhook provedor)
  - `processing → failed` (webhook provedor)
  - `failed → processing` (admin resubmete)
  - `processing → canceled` (admin cancela antes do pagamento)
- Transições inválidas: `paid → *`, `canceled → *`
- Toda transição manual pelo admin exige `note` preenchida 🟡
- Webhook de payout deve verificar HMAC com `timingSafeEqual` antes de processar 🟡
- Dedupe de webhook: `payment_id` único em `withdrawals` — segundo webhook com mesmo ID é ignorado 🟡
- Afiliado não pode cancelar withdrawal em `processing` — apenas admin 🟡
- Reconciliação semanal: Σ `withdrawals.paid` deve igualar Σ `payout_batches.total` 🟡

---

## Máquina de Estado

```
requested ──(admin aprova)──> processing ──(webhook paid)──> paid ✓
    │                               │
    │                               └──(webhook failed)──> failed
    │                               └──(admin cancela)──> canceled ✓
    └──(admin/afiliado cancela)──> canceled ✓

failed ──(admin resubmete)──> processing
```

---

## Fluxo Principal — Solicitação de Saque (Afiliado)

1. Afiliado informa `amount` no formulário de `/finance`
2. Validação client-side: `amount >= min` E `amount <= availableBalance`
3. Seleciona `payment_method` (PIX, conta, Wise)
4. Clica "Solicitar saque" → dialog de confirmação
5. Marca checkbox `canConfirm` + confirma
6. `POST /api/me/withdrawals` com `idempotency_key = uuid_v4()`
7. Backend:
   - Verifica `UNIQUE(affiliate_id, idempotency_key)` — se duplicata, retorna 200 com withdrawal existente
   - `SELECT SUM(commission) FROM commissions WHERE status='available' AND affiliate_id=$1 FOR UPDATE`
   - Valida `amount <= saldo_real`
   - INSERT `withdrawals(status='requested')`
8. Toast de confirmação + extrato atualizado

## Fluxo Principal — Processamento em Lote (Admin)

1. Admin em `/admin/finance` aba "Saques" filtra `status=requested`
2. Seleciona até 50 saques
3. Clica "Processar selecionados" → dialog com total + lista
4. Confirma → `POST /api/admin/payout-batches`
5. Backend (transação atômica):
   ```sql
   BEGIN;
   SELECT id FROM withdrawals
     WHERE id = ANY($ids) AND status = 'requested'
     FOR UPDATE SKIP LOCKED;
   UPDATE withdrawals SET status = 'processing', processed_at = now(), batch_id = $batch_id;
   INSERT INTO payout_batches (total_amount, item_count, created_by_admin_id, status='processing');
   COMMIT;
   ```
6. Dispara pagamentos via provedor PIX/Stripe Connect
7. Webhook de confirmação:
   - `payout.paid` → UPDATE `status='paid'`, `paid_at=now()`
   - `payout.failed` → UPDATE `status='failed'`
8. n8n notifica afiliado via WhatsApp/email ao `paid`

---

## Fluxos Alternativos

- **Idempotency key duplicada:** retorna `200` com withdrawal existente sem criar novo 🟡
- **Saldo insuficiente no momento do INSERT:** retorna `422 Unprocessable` — saldo mudou entre validação client e server 🟡
- **Webhook de payout falhou:** `status = 'failed'`; admin vê na UI e pode resubmeter 🟡
- **Dois admins processando mesmo conjunto:** `SKIP LOCKED` garante que cada withdrawal é processado uma vez 🟡
- **Afiliado tenta cancelar withdrawal em processing:** endpoint retorna `403 Forbidden` 🟡
- **Webhook recebido fora de ordem (paid antes de processing):** tratar via state machine — rejeitar transição inválida 🟡

---

## Dependências

- `profiles` — dados bancários inline (`pix_key`, `bank_name`, `bank_agency`, `bank_account`, `payment_type`) 🟢
- `commissions` — `availableBalance` calculado antes do saque 🔴
- `payout_batches` — rastreabilidade de lotes 🔴
- Provedor PIX (banco/fintech) — webhook de confirmação 🔴
- Stripe Connect (opcional) — para afiliados internacionais 🔴
- n8n — notificação de pagamento confirmado 🔴
- `audit_logs` — trilha de mudanças 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Idempotência | `idempotency_key` UK — duplicatas silenciosas | blueprints | 🟡 |
| Consistência | FOR UPDATE no saldo — saldo nunca negativo | blueprints | 🟡 |
| Segurança | HMAC validation no webhook de payout | blueprints | 🟡 |
| Segurança | `payment_method_id` só acessa próprios dados (RLS) | permissions.md | 🟡 |
| Rastreabilidade | Toda transição com actor_id + note + timestamp | blueprints | 🟡 |
| Disponibilidade | Webhook com retry exponencial em caso de falha de rede | 🔴 não especificado | 🔴 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Saque solicitado
Dado que afiliado tem availableBalance = R$482.50 e payment_method cadastrado
Quando solicita saque de R$200 com idempotency_key válido
Então withdrawal criado com status = "requested"
E saldo disponível reduzido para R$282.50 (bloqueado mas não debitado)

# Happy path — Idempotência
Dado que afiliado submete saque duas vezes com mesmo idempotency_key
Quando segundo request chega
Então retorna 200 com o mesmo withdrawal existente
E nenhum segundo withdrawal é criado

# Happy path — Processamento em lote
Dado que admin seleciona 10 saques em status "requested"
Quando clica "Processar selecionados" e confirma
Então todos os 10 movem para "processing" atomicamente
E payout_batch criado com total e item_count corretos

# Happy path — Pagamento confirmado
Dado que provedor envia webhook payout.paid para withdrawal X
Quando webhook é processado com HMAC válido
Então withdrawal.status = "paid", paid_at = now()
E n8n notifica afiliado via WhatsApp

# Falha — Saldo insuficiente (server-side)
Dado que availableBalance mudou entre validação client e request server
Quando saldo real < amount solicitado
Então server retorna 422 com mensagem "Saldo insuficiente"
E nenhum withdrawal é criado

# Falha — Webhook de payout falhou
Dado que provedor confirma falha de pagamento
Quando payout.failed é recebido
Então withdrawal.status = "failed"
E admin vê na UI com opção de resubmeter

# Borda — Race condition no batch
Dado que dois admins selecionam os mesmos 10 saques simultaneamente
Quando ambos submetem o batch
Então SKIP LOCKED garante que cada withdrawal é processado por apenas um batch
E segundo admin processa apenas os não bloqueados (ou zero)

# Borda — Afiliado tenta cancelar em processing
Dado que withdrawal está em status "processing"
Quando afiliado tenta cancelar via API
Então retorna 403 Forbidden
E withdrawal permanece em "processing"
```

---

## Cenários de Borda (detalhado)

1. **Saldo negativo pós-reversal:** Afiliado sacou R$200, depois venda foi reembolsada (commission_reversal = -R$14.70). Saldo pode ficar negativo em `availableBalance`. Na próxima solicitação de saque, validação `amount <= availableBalance` bloqueia. Admin deve monitorar saldos negativos e resolver manualmente ou via regra de desconto futuro.

2. **PIX chave inválida:** Provedor rejeita pagamento por chave PIX inválida/inexistente. Webhook retorna `payout.failed`. Admin deve contatar afiliado para atualizar dados bancários. Necessário: validação prévia de chave PIX antes de submeter ao provedor.

3. **Timeout de pagamento (sem webhook):** Provedor aceita o pagamento mas nunca envia webhook de confirmação. Withdrawal fica preso em `processing` indefinidamente. Necessário: CRON de reconciliação que consulta status no provedor para withdrawals em `processing` há mais de X horas.

4. **Moeda diferente da comissão:** Comissão gerada em BRL mas afiliado quer sacar em USD (Wise). Necessário: snapshot do FX rate no momento do saque (`fx_rate_at_withdrawal`) para auditoria. `getFxRateFromBRL()` atual é estático — necessário fonte real.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| POST /me/withdrawals com idempotência | Must | Entrada do fluxo — sem isso afiliados não sacam |
| Validação server-side de saldo | Must | Race condition → saldo negativo |
| Batch processing com FOR UPDATE SKIP LOCKED | Must | Race condition em lote |
| Webhook de confirmação (paid/failed) | Must | Sem isso, status trava em processing |
| HMAC validation no webhook | Must | Segurança — qualquer um poderia confirmar pagamentos |
| Notificação via n8n ao paid | Should | UX — não bloqueia financeiro |
| Reconciliação semanal | Should | Detecta drift antes de virar problema |
| Cancelamento pelo afiliado (requested only) | Should | UX — afiliado pode mudar de ideia |
| FX rate snapshot no saque | Should | Auditoria de câmbio |
| Validação prévia de chave PIX | Could | Reduz falhas de pagamento |
| CRON de timeout de webhook | Could | Raramente necessário mas importante ter |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/mock-data.ts` | `FinanceTransaction` (tipo "Withdrawal") | 🟢 |
| `src/lib/admin-finance-data.ts` | `PaymentRecord`, `PaymentMethod` | 🟢 |
| `src/routes/finance.tsx` | formulário de saque | 🟡 não lido diretamente |
| `src/routes/admin.finance.tsx` | aba de saques | 🟡 não lido diretamente |
| Backend POST /me/withdrawals | — | 🔴 não existe |
| Backend payout_batches | — | 🔴 não existe |
| Backend webhook payout | — | 🔴 não existe |
