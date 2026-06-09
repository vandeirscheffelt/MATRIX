# Finance Admin — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

A tela mais complexa do sistema (1710 LOC). Gerencia o ciclo de vida completo de comissões e saques do ponto de vista administrativo: aprovação, processamento em lote, pagamento, auditoria e statement por afiliado. Concentra as operações financeiras mais críticas e de maior risco — qualquer bug aqui tem impacto direto no dinheiro dos afiliados.

---

## Responsabilidades

- Exibir KPIs financeiros globais (gerado, disponível, pago, pendente, em processamento) 🟡
- Filtrar comissões e saques por afiliado, produto, campanha, status e período 🟡
- Selecionar e processar saques em lote (máx. 50 itens) 🟡
- Fazer override manual de status de comissão com nota obrigatória 🟡
- Exibir statement completo por afiliado (sheet/dialog) 🟡
- Exibir timeline de auditoria por comissão 🟡
- Transicionar automaticamente `pending → available` quando `hold_until < today` 🔴 (deve virar CRON)
- Exportar dados financeiros 🟡

---

## Interface

### KPIs do painel admin

```typescript
// Calculados sobre todas as comissões do sistema
totalGenerated   = Σ commissions.commission (todas)
totalAvailable   = Σ commissions WHERE status = 'available'
totalPaid        = Σ commissions WHERE status = 'paid'
totalPending     = Σ commissions WHERE status = 'pending'
totalProcessing  = Σ commissions WHERE status = 'processing'
```

### Filtros disponíveis

```typescript
type CommissionFilters = {
  affiliateId?: string
  productSlug?: string
  campaignId?: string
  status?: CommissionStatus
  dateFrom?: string
  dateTo?: string
  search?: string    // busca em affiliate_name, customer, product_name
}
```

### Constantes operacionais

```typescript
const RELEASE_WINDOW_DAYS = 30   // dias de holding antes de available
const SELECTION_LIMIT = 50       // máx de itens no batch pay
```

> ⚠️ Essas constantes estão nos blueprints mas **não foram encontradas** no código frontend atual. Devem ser definidas como constantes no backend.

### Operações de batch

```typescript
// Seleção
selectedIds: Set<string>    // máx SELECTION_LIMIT itens
selectAll(): void           // seleciona todos filtered, respeitando limite
clearSelection(): void

// Batch pay
batchPay(ids: string[]): Promise<void>
// 1. SELECT commissions WHERE id IN ids AND status = 'available' FOR UPDATE SKIP LOCKED
// 2. UPDATE status = 'processing', INSERT commission_history
// 3. INSERT payout_batch
// 4. Dispara pagamento via provedor

// Override manual
updateCommissionStatus(id: string, newStatus: CommissionStatus, note: string): Promise<void>
```

### Statement por afiliado

```typescript
type AffiliateStatement = {
  affiliate: AdminAffiliate
  commissions: Commission[]    // todas, filtradas por afiliado
  withdrawals: Withdrawal[]
  summary: {
    totalEarned: number
    totalPaid: number
    totalPending: number
    availableNow: number
  }
}
```

---

## Regras de Negócio

- `SELECTION_LIMIT = 50` — batch pay limitado a 50 itens por vez para evitar timeouts e lock contention 🟡
- `RELEASE_WINDOW_DAYS = 30` — holding antes de liberar comissão 🟡
- Transição `pending → available` deve ser feita por CRON às 00:05 UTC — não por `useEffect` client-side 🔴
- Toda mudança manual de status exige `note` preenchida + `actor_id` registrado 🟡
- Mudança para `paid` exige re-confirm adicional (dialog de confirmação + loader) 🟢
- Batch pay usa `SELECT FOR UPDATE SKIP LOCKED` para evitar race condition 🟡
- Admin não deve ter acesso a dados bancários não-mascarados dos afiliados (PII) 🟡
- Statement por afiliado é somente leitura 🟡
- Timeline de auditoria é append-only — admin não pode editar histórico 🟡
- Filtros multidimensionais são cumulativos (AND, não OR) 🟡
- `batchPay` cria um `payout_batch` por execução — rastreabilidade de lotes 🟡
- Status `failed` permite retry: admin move de volta para `processing` 🟡
- Skeleton de loading exibido enquanto dados carregam 🟡
- Empty state com ícone "Inbox" quando filtro não retorna resultados 🟢

---

## Fluxo Principal — Aprovação em Lote

1. Admin acessa `/admin/finance`, aba "Comissões"
2. Aplica filtros (afiliado, produto, status=available, período)
3. Seleciona itens individualmente ou "Select All" (até 50)
4. Preview do total selecionado aparece no rodapé
5. Clica "Pagar selecionadas" → dialog de confirmação com total + lista resumida
6. Admin confirma → backend processa:
   ```sql
   BEGIN;
   SELECT id FROM commissions
     WHERE id = ANY($ids) AND status = 'available'
     FOR UPDATE SKIP LOCKED;
   -- processa apenas os que conseguiu lock
   UPDATE commissions SET status = 'processing' WHERE id = ANY($locked_ids);
   INSERT INTO commission_history (...) FOR EACH;
   INSERT INTO payout_batches (total, item_count, created_by_admin_id, status='processing');
   COMMIT;
   ```
7. Dispara pagamento via provedor (PIX/Stripe Connect)
8. Webhook de confirmação → UPDATE `status = 'paid'`, `paid_at = now()`
9. INSERT commission_history: `processing → paid`, actor = sistema

## Fluxo Principal — Override Manual de Status

1. Admin clica no menu de ações da linha de comissão
2. Seleciona novo status no dropdown (com restrições de transição)
3. Modal aparece com campo de nota obrigatório
4. Admin preenche justificativa e confirma
5. Backend valida transição permitida
6. UPDATE commission.status + INSERT commission_history
7. UI atualiza linha sem reload completo

## Fluxo Principal — Statement de Afiliado

1. Admin clica em "Ver statement" na linha de um afiliado
2. Sheet/dialog abre com statement completo
3. Exibe: KPIs do afiliado + lista de comissões + lista de saques + timeline de pagamentos
4. Somente leitura — admin não pode editar a partir daqui

---

## Fluxos Alternativos

- **Race condition no batch:** segundo admin seleciona os mesmos itens → `SKIP LOCKED` → segundo batch processa apenas itens não bloqueados; itens já em `processing` não são duplicados 🟡
- **Webhook de payout falhou:** UPDATE `status = 'failed'`; admin vê na UI e pode resubmeter manualmente 🟡
- **Auto-transition useEffect (estado atual):** `pending → available` quando `hold_until < today` — frágil, só funciona se a página estiver aberta 🔴 Deve ser substituído por CRON
- **Filtro sem resultados:** exibe empty state com ícone Inbox + mensagem "No commissions found" 🟢
- **Seleção ultrapassa SELECTION_LIMIT:** "Select All" limita automaticamente a 50; toast de aviso 🟡

---

## Dependências

- `admin-finance-data.ts` — `AdminAffiliate`, `CommissionStatus`, `mockAdminAffiliates` 🟢
- `mock-data.ts` — `mockFinance`, `FinanceTransaction` 🟢
- `commissions` module — fonte principal de dados 🔴
- `withdrawals` module — aba de saques 🔴
- `payout_batches` — criado no batch pay 🔴
- `commission_history` — audit log 🔴
- Payout provider (PIX/Stripe Connect) — webhook de confirmação 🔴
- CRON — release automático de comissões 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Consistência | SELECT FOR UPDATE SKIP LOCKED no batch pay | blueprints | 🟡 |
| Auditabilidade | Toda mudança de status tem actor_id + note + timestamp | `admin-finance-data.ts` | 🟢 |
| Segurança | Admin não vê dados bancários não-mascarados | blueprints | 🟡 |
| Performance | Paginação server-side para >1k comissões | 1710 LOC na rota | 🟡 |
| Disponibilidade | CRON substitui useEffect — release não depende de página aberta | 🔴 crítico | 🔴 |
| UX | Skeleton loading + empty state com Inbox icon | blueprints | 🟢 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Batch pay sem race condition
Dado que 10 comissões estão em status "available"
E dois admins selecionam as mesmas 10 comissões simultaneamente
Quando ambos submetem o batch
Então SELECT FOR UPDATE SKIP LOCKED garante que cada comissão é paga apenas uma vez
E um dos admins recebe feedback de que itens já estavam em processamento

# Happy path — Override manual
Dado que comissão está em status "pending"
Quando admin seleciona "canceled" e preenche nota "Cliente solicitou estorno"
Então commission.status = "canceled"
E commission_history registra: from=pending, to=canceled, note="Cliente...", actor_id=admin, ts=now

# Happy path — Statement de afiliado
Dado que admin clica em "Ver statement" para afiliado VAN01
Quando sheet abre
Então exibe todas as comissões de VAN01 com totais corretos
E admin não consegue editar nenhum dado

# Falha — Transição inválida
Dado que comissão está em status "paid"
Quando admin tenta mover para "pending"
Então sistema rejeita com erro "Transição inválida: paid → pending"
E commission_history não é alterado

# Falha — Batch acima do limite
Dado que 60 comissões estão disponíveis
Quando admin clica "Select All"
Então apenas 50 são selecionadas
E toast informa que limite de 50 itens foi atingido

# Falha — CRON não rodou (estado atual)
Dado que useEffect de auto-transition não rodou (página fechada)
Quando comissão com hold_until expirado ainda está em "pending"
Então comissão permanece pending indefinidamente
⚠️ Este comportamento é a razão pela qual CRON é obrigatório

# Borda — Payout falhou após batch
Dado que batch de 10 comissões foi processado (status=processing)
Quando webhook do provedor retorna falha para todas
Então todas voltam para status="failed"
E admin pode selecionar as falhas e resubmeter individualmente

# Borda — Admin fecha dialog no meio do batch
Dado que batch está em andamento (loader visível)
Quando admin fecha o dialog acidentalmente
Então operação continua no servidor independente da UI
E ao recarregar, comissões já em processing aparecem corretamente
```

---

## Cenários de Borda (detalhado)

1. **useEffect de auto-transition (problema crítico atual):** A transição `pending → available` é feita via `useEffect` que só executa quando a aba `/admin/finance` está aberta no browser. Se nenhum admin acessar a aba por dias, comissões ficam presas em `pending` além do período de holding. Afiliados não conseguem sacar. Migração para CRON é obrigatória e urgente.

2. **Batch pay parcial por SKIP LOCKED:** Se 50 comissões são selecionadas mas 5 estão sendo processadas por outro admin simultaneamente, o `SKIP LOCKED` retorna apenas 45. O backend deve retornar ao admin quantos foram efetivamente processados e quais ficaram de fora — não silenciar a diferença.

3. **Reconciliação de drift:** Somatório de `commissions.paid` deve igualar o somatório de `payout_batches.total`. Se houver divergência (bug, falha de rede no webhook), CRON semanal de reconciliação detecta e gera alerta para admin. Sem reconciliação, drift pode acumular silenciosamente.

4. **Statement com volume alto:** Afiliado com 1000+ comissões — statement como sheet/dialog não escala. Necessário: paginação dentro do statement ou export como CSV para volumes altos.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| CRON release `pending → available` | Must | Substitui useEffect — crítico para funcionamento |
| SELECT FOR UPDATE SKIP LOCKED | Must | Race condition destrói financeiro |
| commission_history obrigatório | Must | Auditoria regulatória |
| Override manual com nota | Must | Operação administrativa necessária |
| Batch pay com payout_batch | Must | Modelo operacional de pagamento |
| Filtros multidimensionais | Should | UX administrativo |
| Statement por afiliado | Should | Transparência operacional |
| Reconciliação semanal | Should | Detecta drift antes de virar problema |
| Skeleton + empty state | Could | UX — não bloqueia negócio |
| Paginação server-side do statement | Could | Otimização para volume alto |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/admin-finance-data.ts` | `AdminAffiliate`, `CommissionStatus`, `AffiliateSale`, `PaymentRecord`, `mockAdminAffiliates` | 🟢 |
| `src/lib/mock-data.ts` | `mockFinance`, `FinanceTransaction`, `mockTransactions` | 🟢 |
| `src/routes/admin.finance.tsx` | `AdminFinancePage` (1710 LOC) | 🟡 não lido diretamente |
| Backend commission engine | — | 🔴 não existe |
| Backend payout_batches | — | 🔴 não existe |
| CRON release job | — | 🔴 não existe |
| commission_history triggers | — | 🔴 não existe |
