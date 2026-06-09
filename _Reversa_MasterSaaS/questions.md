# Questões Pendentes — MasterSaaS
> Reviewer (Reversa v1.2.14) — 2026-06-08
> Apenas lacunas 🔴 que bloqueiam reimplementação fiel.

---

## Q-01 — Retroatividade do Performance Boost

**Spec afetada:** `sdd/promotions.md` — Cenário de Borda 2
**Bloco do problema:**
> "Política atual: prospectiva apenas (5ª venda e seguintes ganham 60%). Se retroativa: 4 comissões anteriores precisariam ser recalculadas. Esta decisão de produto está em aberto."

**Pergunta:** Quando um afiliado atinge o threshold do Performance Boost (ex: 5ª venda), as 4 vendas anteriores na mesma campanha são recalculadas com a taxa maior, ou apenas as vendas a partir desse ponto ganham a nova taxa?

**Impacto:** Define se é necessário job de recálculo retroativo no backend ou apenas aplicar taxa prospectivamente.

**Resposta:** ___

---

## Q-02 — Quem cria o registro de venda (webhook vs admin manual)

**Spec afetada:** `sdd/sales-subscriptions.md`
**Bloco do problema:**
> "Em produção será alimentado exclusivamente por webhooks do Stripe e de produtos SaaS externos."

**Pergunta:** No MVP inicial (antes do Stripe/AppMax estarem integrados), como as vendas serão registradas? Admin cria manualmente no painel, ou o sistema só funciona após webhook configurado?

**Impacto:** Define se é necessário endpoint de criação manual de venda no MVP.

**Resposta:** ___

---

## Q-03 — `Sale.commission_snapshot` vs `Commission.commission` — qual é a fonte de verdade?

**Spec afetada:** `sdd/sales-subscriptions.md` + `sdd/commissions.md`
**Bloco do problema:**
> `Sale` tem `commission_snapshot` e `commission_rate_snapshot`
> `Commission` tem `commission` (calculado) e `rate_snapshot`

**Pergunta:** O registro de `Sale` vai armazenar `commission_snapshot` como campo próprio, ou o cálculo fica apenas em `commissions`? Ter os dois cria risco de divergência.

**Impacto:** Define schema final da tabela `mastersaas.sales`. Se manter ambos: necessário garantir consistência entre eles. Se remover de `sales`: mais simples, mas perde snapshot direto.

**Resposta:** ___

---

## Q-04 — Elegibilidade de rede: janela deslizante ou data fixa?

**Spec afetada:** `sdd/network.md`
**Bloco do problema:**
> "`daysSinceLastSale > rules.eligibilityDays` → false"

**Pergunta:** Os `eligibilityDays` são medidos como janela deslizante (últimos 30 dias a partir de hoje) ou a partir da última venda registrada? Exemplo: afiliado vendeu há 25 dias — elegível. Próxima verificação em 10 dias: ele ainda será elegível mesmo sem nova venda?

**Impacto:** Define exatamente o que `lastPersonalSaleAt` precisa capturar e como o CRON de elegibilidade deve funcionar.

**Resposta:** ___

---

## Q-05 — `payment_methods` — tabela própria ou campo inline no withdrawal?

**Spec afetada:** `sdd/withdrawals-payout.md`
**Bloco do problema:**
> "`payment_method_id: string — FK payment_methods` 🔴"

**Pergunta:** O afiliado vai cadastrar múltiplos métodos de pagamento (PIX + conta bancária) e escolher qual usar no saque, ou o sistema só guarda um método por afiliado?

**Impacto:** Se múltiplos: necessário tabela `payment_methods` com CRUD próprio. Se um único: campo inline no perfil do afiliado é suficiente e elimina a FK.

**Resposta:** ___
