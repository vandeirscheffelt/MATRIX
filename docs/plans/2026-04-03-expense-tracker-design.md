# Design — App de Controle de Gastos Pessoais

**Data:** 2026-04-03  
**Status:** Aprovado  
**App:** `apps/expense-tracker/`

---

## Contexto

App web pessoal (uso único, sem multi-usuário) para controle de gastos mensais com foco em não esquecer pagamentos. Inspirado no Splitwise — checklist visual por status.

---

## Público

Uso pessoal exclusivo. Sem auth complexa — sessão única ou senha simples.

---

## Stack

- **Frontend + Backend:** Next.js App Router + TypeScript
- **Banco:** Supabase (PostgreSQL)
- **UI:** shadcn/ui + Tailwind CSS
- **Isolado em:** `apps/expense-tracker/` — sem dependências de outros apps do monorepo

---

## Entidades

### `Conta` — template recorrente
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| nome | text | Ex: "Mestrado", "Netflix" |
| categoria | text | Moradia, Educação, Assinaturas, Alimentação, etc. |
| forma_pagamento | enum | `boleto` \| `cartao` |
| dia_vencimento | int | Dia do mês (1–31) |
| ativa | boolean | Se gera pagamentos mensais |
| criada_em | timestamp | |

### `Pagamento` — instância mensal
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| conta_id | uuid | FK → Conta |
| mes_referencia | date | Primeiro dia do mês (ex: 2026-04-01) |
| valor_pago | numeric | Preenchido ao marcar como pago |
| status | enum | `pendente` \| `pago` |
| pago_em | timestamp | Data/hora que marcou como pago |

### `Parcelamento` — compra parcelada no cartão
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| nome | text | Ex: "iPhone 14" |
| valor_total | numeric | Ex: 1800.00 |
| num_parcelas | int | Ex: 12 |
| valor_parcela | numeric | Calculado, mas editável |
| mes_inicio | date | Primeiro dia do mês inicial |
| cartao | text | Ex: "Nubank" |
| ativo | boolean | |
| criado_em | timestamp | |

### `ParcMensal` — parcela do mês
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| parcelamento_id | uuid | FK → Parcelamento |
| mes_referencia | date | |
| numero_parcela | int | Ex: 3 (de 12) |
| valor_parcela | numeric | Pode diferir do padrão |
| status | enum | `pendente` \| `pago` |
| pago_em | timestamp | |

---

## Tela Principal — Checklist Mensal

```
Abril 2026                          [ + Nova Conta ]

🔴 VENCIDAS
  Aluguel          venc. dia 01    R$ —      [ Marcar pago ]

📋 PENDENTES
  Mestrado         venc. dia 15    R$ —      [ Marcar pago ]
  Cartão Nubank    venc. dia 20    R$ —      [ Marcar pago ]
  Netflix          venc. dia 22    R$ —      [ Marcar pago ]

✅ PAGAS
  Internet         pago dia 02     R$ 99,90  ✓
  Spotify          pago dia 03     R$ 21,90  ✓

────────────────────────────────────
Total pago:    R$ 121,80
A pagar:       R$ —

▼ PARCELAMENTOS ATIVOS
  iPhone 14        3/12    R$ 150,00/mês    ████████░░░░  25%
  Notebook        10/24    R$ 210,00/mês    ██████████░░  42%
  Curso Online     1/6     R$ 89,90/mês     ██░░░░░░░░░░   8%

  Total parcelas este mês:  R$ 449,90
```

### Modal "Marcar pago"
```
Mestrado — Abril 2026
Valor pago: [ R$ _______ ]
            [ Confirmar ]
```

---

## Navegação

| Rota | Tela |
|------|------|
| `/` | Checklist do mês atual |
| `/historico` | Lista de meses anteriores + total por categoria |
| `/contas` | CRUD de contas recorrentes |
| `/parcelamentos` | CRUD de parcelamentos com barra de progresso |

---

## Fluxo de geração automática

1. Ao abrir o app em um novo mês, verifica se os `Pagamento` do mês já existem
2. Se não existirem, gera automaticamente a partir das `Conta` ativas
3. Mesmo fluxo para `ParcMensal` — gera a parcela do mês para cada `Parcelamento` ativo
4. Parcelas encerradas (num_parcela = total) marcam o parcelamento como inativo

---

## Isolamento no monorepo

- Pasta: `apps/expense-tracker/`
- Next.js standalone, sem imports de `apps/web` ou `apps/api`
- Pode usar `packages/ui` (shadcn) se conveniente, mas sem obrigatoriedade
- `.env` próprio com Supabase project dedicado ou schema separado

---

## Schema de banco recomendado

```sql
CREATE SCHEMA IF NOT EXISTS expenses;

-- todas as tabelas dentro de expenses.*
CREATE TABLE expenses.contas (...);
CREATE TABLE expenses.pagamentos (...);
CREATE TABLE expenses.parcelamentos (...);
CREATE TABLE expenses.parc_mensais (...);
```
