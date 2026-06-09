# Finance (Afiliado) — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Módulo que expõe ao afiliado seu saldo financeiro, extrato de transações e permite solicitar saques. Contém funcionalidade crítica de privacidade (auto-hide de saldo) e cadastro de dados bancários/PIX. É o módulo com maior risco de segurança no estado atual: dados bancários (PII) são armazenados em localStorage sem criptografia — migração para backend criptografado é obrigatória antes de qualquer usuário real.

---

## Responsabilidades

- Exibir saldo disponível, pendente, total ganho e total sacado 🟢
- Ocultar saldo automaticamente após 30s (modo privacidade) 🟢
- Permitir toggle manual de visibilidade de saldo 🟢
- Validar e processar solicitação de saque 🟡
- Armazenar dados bancários/PIX do afiliado 🔴 (em localStorage — migrar urgente)
- Exibir extrato paginado com filtros por tipo, status e data 🟡
- Confirmar saque via modal com checkbox obrigatório 🟢

---

## Interface

### Saldo (mock atual)

```typescript
const mockFinance = {
  availableBalance: 482.5,    // Σ commissions status='available'
  pendingBalance: 145.0,      // Σ commissions status='pending'
  totalEarned: 2310.75,       // Σ comissões não-refunded/canceled
  totalWithdrawn: 1683.25,    // Σ withdrawals status='paid'
}
```

### Tipo `FinanceTransaction`

```typescript
type FinanceTransaction = {
  id: string
  date: string                                         // ISO yyyy-mm-dd
  type: "Commission" | "Withdrawal"
  description: string
  amount: number                                       // negativo para withdrawal
  status: "Paid" | "Pending" | "Processing" | "Failed"
}
```

### Dados bancários (PII — localStorage atual)

```typescript
// Salvo em localStorage("affiliate_payment_details") — 🔴 CRÍTICO
type PaymentDetails = {
  type: "pix" | "bank" | "wise"
  pixKey?: string              // CPF, CNPJ, email, telefone ou chave aleatória
  bankName?: string
  branch?: string
  account?: string
  holderName?: string
  taxId?: string               // CPF/CNPJ — PII crítico
  country?: string
  phone?: string
}
```

### APIs futuras (backend)

```typescript
GET  /api/me/balance                    // saldo atual
GET  /api/me/transactions?from&to&type&status&search&page
POST /api/me/withdrawals                // solicitar saque
PUT  /api/me/payment-method            // cadastrar/atualizar dados bancários
GET  /api/me/payment-method            // consultar dados (retorna mascarado)
```

---

## Regras de Negócio

- Saldo disponível = Σ `commissions.available` − Σ `withdrawals.processing+paid` por afiliado 🟡
- Saldo pendente = Σ `commissions.pending` 🟡
- Auto-hide de saldo após 30s sem interação — toggle manual disponível 🟢
- Valor de saque deve ser ≥ mínimo (🔴 valor não definido no código)
- Valor de saque deve ser ≤ `availableBalance` 🟢
- Confirmação obrigatória via checkbox `canConfirm` antes de submeter saque 🟢
- Dados bancários NUNCA podem ficar em localStorage — migração urgente para banco criptografado 🔴
- `withdrawal` requer `payment_method` cadastrado antes de solicitar 🟡
- Idempotência: `idempotency_key` único por solicitação de saque (gerado client-side) 🟡
- Extrato exibe `amount` negativo para withdrawals e positivo para comissões 🟢
- Saldo nunca pode ser negativo após saque aprovado 🟡
- Dados bancários retornados sempre mascarados na leitura (ex: `****1234` para conta) 🟡

---

## Fluxo Principal — Exibição de Saldo

1. Afiliado acessa `/finance`
2. `GET /api/me/balance` → `{availableBalance, pendingBalance, totalEarned, totalWithdrawn}`
3. Exibe KPIs com toggle hide/show
4. Timer de 30s iniciado ao exibir saldo
5. Ao expirar: saldo ocultado automaticamente
6. Afiliado pode re-exibir clicando no toggle a qualquer momento

## Fluxo Principal — Solicitação de Saque

1. Afiliado informa valor desejado no input
2. Validação client-side: `amount >= minWithdrawal` (🔴) E `amount <= availableBalance`
3. Clica "Solicitar saque" → dialog de confirmação aparece
4. Afiliado marca checkbox `canConfirm` + lê resumo
5. Confirma → `POST /api/me/withdrawals` com `{amount, payment_method_id, idempotency_key}`
6. Backend valida: saldo real, método cadastrado, idempotency_key único
7. INSERT em `withdrawals` com `status = "requested"`
8. Toast de confirmação + extrato atualizado

## Fluxo Principal — Cadastro de Dados Bancários

1. Afiliado abre modal de dados de pagamento
2. Seleciona tipo: PIX / Conta Bancária / Wise
3. Preenche campos conforme tipo
4. `PUT /api/me/payment-method` → backend criptografa campos sensíveis (pgcrypto/Vault)
5. Confirma salvamento
6. Modal fecha — dados exibidos mascarados na próxima abertura

---

## Fluxos Alternativos

- **Saldo insuficiente para saque:** validação client bloqueia + mensagem de erro 🟢
- **Sem payment_method cadastrado:** botão de saque desabilitado ou redireciona para cadastro 🟡
- **Saque duplicado (duplo clique):** `idempotency_key` único por request garante apenas um `withdrawal` 🟡
- **Auto-hide enquanto afiliado digita valor:** timer deve ser pausado durante interação ativa 🟡
- **Extrato vazio:** estado empty com ilustração "Nenhuma transação encontrada" 🟡
- **Erro de rede ao solicitar saque:** `toast.error` com mensagem + extrato não alterado 🟡

---

## Dependências

- `mock-data.ts` — `mockFinance`, `mockTransactions`, `FinanceTransaction`, `formatCurrency` 🟢
- `commissions` module — fonte de `availableBalance` e `pendingBalance` 🔴
- `withdrawals` module — INSERT de solicitações de saque 🔴
- `payment_methods` tabela — armazenamento criptografado de PII 🔴
- Backend API — `GET /me/balance`, `POST /me/withdrawals`, `PUT /me/payment-method` 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança CRÍTICA | PII financeiro (CPF, conta, PIX) nunca em localStorage | ADR-003 | 🟢 |
| Segurança | Dados bancários criptografados at-rest (pgcrypto ou Vault) | blueprints | 🟡 |
| Segurança | Leitura de payment_method retorna sempre mascarado | blueprints | 🟡 |
| Privacidade | Auto-hide de saldo após 30s | `src/routes/finance.tsx` (inferido) | 🟢 |
| Idempotência | idempotency_key em toda solicitação de saque | blueprints | 🟡 |
| Consistência | Saldo calculado server-side — nunca confiar no client | blueprints | 🟡 |
| UX | ErrorBoundary por seção — falha parcial não derruba a página | blueprints | 🟡 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Exibição de saldo
Dado que afiliado tem availableBalance = R$482.50
Quando acessa /finance
Então saldo é exibido corretamente
E após 30s sem interação o saldo é ocultado automaticamente

# Happy path — Toggle manual de saldo
Dado que saldo está oculto
Quando afiliado clica no ícone de olho
Então saldo é exibido novamente e timer reinicia

# Happy path — Saque válido
Dado que availableBalance = R$482.50 e payment_method cadastrado
Quando afiliado solicita saque de R$200
E marca o checkbox canConfirm
E confirma
Então withdrawal criado com status = "requested"
E extrato atualizado com nova entrada tipo "Withdrawal"

# Falha — Valor acima do saldo
Dado que availableBalance = R$482.50
Quando afiliado tenta sacar R$500
Então validação bloqueia o submit com mensagem de erro
E nenhum withdrawal é criado

# Falha — Saque duplicado
Dado que afiliado submete saque duas vezes (duplo clique)
Quando segundo request chega com mesmo idempotency_key
Então apenas um withdrawal é criado

# Falha — Sem payment_method
Dado que afiliado não cadastrou dados bancários
Quando tenta solicitar saque
Então é direcionado para cadastrar método de pagamento primeiro

# Borda — localStorage com PII (estado atual)
Dado que afiliado cadastrou dados bancários no estado atual
Quando dados são salvos
Então ficam em localStorage("affiliate_payment_details") em texto puro
⚠️ Este comportamento DEVE ser eliminado antes de qualquer usuário real

# Borda — Saldo calculado com comissão em processing
Dado que afiliado tem commission de R$100 em status "processing" (em pagamento)
Quando saldo é calculado
Então availableBalance NÃO inclui esse valor (já saiu do saldo disponível)
```

---

## Cenários de Borda (detalhado)

1. **PII em localStorage — risco imediato:** No estado atual, CPF, dados bancários e chave PIX ficam em `localStorage("affiliate_payment_details")` em texto puro. Qualquer extensão de browser maliciosa ou XSS tem acesso trivial. Migração para `payment_methods` criptografado é **pré-requisito absoluto** antes de onboarding de qualquer usuário real.

2. **Valor mínimo de saque não definido:** O blueprint menciona validação `amount >= minWithdrawal` mas o valor mínimo não está definido no código. Necessário: configuração em `network_settings` ou constante de produto. Sugestão: R$50 mínimo.

3. **Saldo calculado com race condition:** Dois saques solicitados simultaneamente podem passar na validação de saldo client-side com o mesmo `availableBalance`. Necessário: validação server-side com `SELECT ... FOR UPDATE` na `availableBalance` antes de INSERT do withdrawal.

4. **Extrato com paginação e filtros:** Com volume alto de transações (>500), paginação client-side não escala. Necessário: paginação server-side com cursor ou offset, filtros aplicados no banco.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Migrar PII de localStorage para banco criptografado | Must | Risco de segurança crítico — pré-requisito |
| Cálculo de saldo server-side | Must | Cliente não pode ser fonte de verdade financeira |
| Solicitação de saque com idempotência | Must | Duplicatas destroem financeiro |
| Validação de saldo server-side | Must | Race condition com múltiplos requests |
| Auto-hide de saldo (30s) | Should | Privacidade — não bloqueia negócio |
| Extrato com filtros | Should | UX importante mas não crítico |
| ErrorBoundary por seção | Should | Resiliência da UI |
| Valor mínimo de saque configurável | Should | Operacional — definir antes do go-live |
| Paginação server-side do extrato | Could | Otimização para volume alto |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/mock-data.ts` | `mockFinance`, `mockTransactions`, `FinanceTransaction`, `formatCurrency` | 🟢 |
| `src/routes/finance.tsx` | `FinancePage` | 🟡 não lido diretamente |
| `src/lib/admin-finance-data.ts` | `PaymentRecord`, `PaymentMethod` | 🟢 |
| Backend payment_methods (criptografado) | — | 🔴 não existe |
| Backend POST /me/withdrawals | — | 🔴 não existe |
