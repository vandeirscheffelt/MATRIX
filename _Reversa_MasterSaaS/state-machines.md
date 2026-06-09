# Máquinas de Estado — MasterSaaS
> Gerado pelo Detetive (Reversa v1.2.14) — 2026-06-08
> 🟢 CONFIRMADO | 🟡 INFERIDO | 🔴 LACUNA

---

## 1. Comissão (Commission)

> ⚠️ Divergência: frontend usa `pending | processing | paid | partially_paid | reversed`. Backend deve adotar schema do blueprint que é mais completo.

### Schema recomendado para o backend

```mermaid
stateDiagram-v2
    [*] --> pending : venda criada (webhook Stripe)
    pending --> available : CRON 00:05 UTC (hold_until < now)
    pending --> canceled : admin cancela
    pending --> refunded : estorno antes do hold
    available --> processing : admin aprova / batch
    available --> canceled : admin cancela
    processing --> paid : webhook payout confirmado
    processing --> failed : webhook payout falhou
    processing --> canceled : admin cancela
    paid --> [*] : terminal
    refunded --> [*] : terminal
    canceled --> [*] : terminal
    failed --> processing : retry (admin resubmete)
```

### Transições inválidas (bloquear no backend)
- `paid → qualquer` — comissão paga é imutável
- `refunded → qualquer` — estorno é terminal
- `canceled → paid` — cancelado não pode ser pago diretamente

### Gatilhos por transição

| Transição | Gatilho | Responsável |
|-----------|---------|-------------|
| `→ pending` | Webhook `checkout.session.completed` | Stripe / Produto SaaS |
| `pending → available` | CRON diário 00:05 UTC | pg_cron ou n8n |
| `→ canceled` | Admin action | Admin via UI |
| `→ refunded` | Webhook `charge.refunded` | Stripe |
| `available → processing` | Admin batch pay | Admin via UI |
| `processing → paid` | Webhook payout provider | PIX / Stripe Connect |
| `processing → failed` | Webhook payout failed | PIX / Stripe Connect |

---

## 2. Saque (Withdrawal)

```mermaid
stateDiagram-v2
    [*] --> requested : afiliado solicita saque
    requested --> processing : admin aprova
    requested --> canceled : admin ou afiliado cancela
    processing --> paid : payout confirmado
    processing --> failed : payout falhou
    failed --> processing : admin resubmete
    paid --> [*] : terminal
    canceled --> [*] : terminal
```

### Regras de validação no `requested`
- `amount >= minWithdrawal` (🔴 valor não definido)
- `amount <= availableBalance`
- `payment_method` cadastrado e válido
- `idempotency_key` único por (affiliate_id, key)

---

## 3. Assinatura (Subscription)

```mermaid
stateDiagram-v2
    [*] --> pending : signup sem pagamento
    pending --> active : primeiro pagamento confirmado
    active --> active : pagamento recorrente OK
    active --> at_risk : pagamento falhou (invoice.payment_failed)
    at_risk --> active : pagamento recuperado
    at_risk --> canceled : cancelamento confirmado
    active --> canceled : customer.subscription.deleted
    canceled --> [*] : terminal
```

### Regra de comissão recorrente
- Enquanto `active` E `payments_made < commissionDurationMonths` (ou Lifetime): gera nova commission mensal
- Ao `canceled`: interrompe geração futura, preserva históricas

---

## 4. Promoção (Promotion) — estado calculado, não armazenado

```mermaid
stateDiagram-v2
    [*] --> disabled : enabled=false
    [*] --> upcoming : enabled=true, now < startDate
    upcoming --> active : now >= startDate
    active --> expired : now > endDate (23:59:59)
    disabled --> upcoming : admin ativa (enabled=true)
    disabled --> active : admin ativa (enabled=true) e datas válidas
    active --> disabled : admin desativa
    upcoming --> disabled : admin desativa
    expired --> [*] : leitura apenas
```

---

## 5. Afiliado / Profile (proposto para backend)

```mermaid
stateDiagram-v2
    [*] --> pending_email_confirm : signup
    pending_email_confirm --> active : email confirmado
    active --> suspended : admin suspende (🔴 não implementado)
    suspended --> active : admin reativa
    active --> terminated : admin encerra conta
    terminated --> [*] : terminal
```

---

## 6. Tutorial Progress (por usuário × tutorial)

```mermaid
stateDiagram-v2
    [*] --> not_started : tutorial existe, sem registro
    not_started --> in_progress : usuário assiste parcialmente (🔴 inferido)
    not_started --> completed : usuário marca como completo
    in_progress --> completed : usuário completa
    completed --> [*]
```

> 🟡 Estado `in_progress` inferido — o código atual rastreia `watched` (boolean) por vídeo, sem duração intermediária.

---

## 7. Campanha de Rede (NetworkCampaign) — calculado

```mermaid
stateDiagram-v2
    [*] --> disabled : enabled=false
    [*] --> scheduled : enabled=true, now < startDate
    scheduled --> active : now >= startDate
    active --> expired : now > endDate
    disabled --> scheduled : admin ativa
    active --> disabled : admin desativa
```
