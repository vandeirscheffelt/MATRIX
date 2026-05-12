# Shaikron — STATUS

**Última atualização:** 2026-05-11

---

## ✅ O que está funcionando

- Auth (Supabase — email/password)
- Multi-tenant por `empresa_id`
- CRUD de profissionais, serviços, grade de horários
- Agenda com timezone por empresa (`America/Sao_Paulo` default)
- Agendamentos salvos em UTC real via `date-fns-tz`
- Deploy: API na porta 3004, Frontend na porta 3005, ambos com HTTPS
- Billing com **dois gateways**: Stripe (cartão) + AppMax (PIX e Boleto)
- Checkout envia `usuariosExtras` corretamente para ambos os gateways
- `stripe-provider.ts` inclui itens de usuário extra na sessão do Stripe
- `AccountPage.tsx` carrega status real da assinatura via `GET /app/billing/status`
- `aiUserCount` nas dependências do `useCallback` — valor correto no checkout
- WhatsApp do Gerente: campo compacto no cabeçalho da AccountPage (sem card separado)
- Rota `POST /app/billing/portal` — suporta Stripe e AppMax conforme gateway ativo
- **Trial de 3 dias** para novos cadastros (era 24h)
- **Paywall pós-trial**: `AppLayout` trava o app quando `bloqueado: true`, exibindo tela de upgrade; libera apenas `/account`, `/billing/success` e `/billing/cancel`
- **Banner de aviso**: aparece nos últimos 2 dias de trial sem bloquear a navegação
- **Cupom de desconto**: campo opcional "Tenho um cupom" na seção de pagamento; Stripe aplica via `promotion_code` (ou `allow_promotion_codes: true` se campo vazio); AppMax via `coupon_code` no order
- **Sistema de Cupons via Banco**:
  - Tabela `Coupon` para gerenciar códigos, tipos (percent/fixed) e validade.
  - Tabela `CouponUsage` para controle de uso único por empresa.
  - Rota `GET /app/billing/validate-coupon` para validação em tempo real no frontend.
  - **Desconto Visual**: O Resumo Mensal agora exibe a linha de desconto e abate o valor do Total Mensal.
  - **AppMax Integration**: O backend calcula o preço reduzido e envia o valor final para o AppMax (PIX/Boleto).
  - **Bypass de 100% de desconto**: Se o desconto cobrir todo o valor, ativa a conta instantaneamente por 30 dias sem passar por AppMax ou Stripe.
  - **Gestão no Admin**: Criação, listagem, ativação/desativação (Stripe PromoCode Sync) e exclusão definitiva de cupons com validação via `Cascade`.
- **UX do Faturamento (Account Page)**:
  - Destaca dinamicamente o valor da fatura (`Subtotal`) em relação ao plano Base.
  - Proteção de Downgrade: Alerta crítico vermelho antes de remover membros (sem estorno de PIX).
  - Fluxo "Sexto Elemento": Ocultação do botão de adicionar mais membros para contas ativadas por PIX/Boleto, prevenindo micro-faturas.
- **Cancelamento (Churn)**:
  - Lógica bifurcada (`POST /app/billing/cancel`).
  - **Stripe**: Define `cancel_at_period_end: true` e preserva acesso até o vencimento.
  - **PIX/Boleto (AppMax)**: Sem renovação automática; sistema apenas informa que expirará sem cobrança extra.
  - Ocultação de portal do cliente para usuários AppMax/PIX.

---

## ⚠️ Bugs / Pendências em aberto

### 1. Redirect pós-pagamento exibe layout "trial"
- **Causa:** navegação full-page do Stripe zera o estado React; `aiUserCount` volta a 0; o webhook pode ainda não ter processado quando o usuário retorna a `/account`
- **Sintoma:** ao retornar de `/billing/success`, a AccountPage ainda exibe status "trial" e checkout com R$97
- **Próxima ação:** polling ou query param `?payment=success` em `BillingSuccessPage.tsx` para aguardar webhook antes de redirecionar; ou `BillingSuccessPage` chamar `GET /app/billing/status` em loop até `ACTIVE`

### 2. Log de debug ainda ativo em billing.ts
- Linha 77 em `apps/api/src/routes/app/billing.ts` loga `rawBody` em produção
- **Remover após validação**: `request.log.info({ ... }, 'checkout body recebido')`

### 3. Bug intervalo de almoço (pendente desde antes)
- Colunas existem no banco (`intervalo_inicio`, `intervaloFim`), Prisma mapeado, frontend envia — dados não chegam no banco
- Debug já deployado na rota `PUT /app/profissionais/:id`
- Para diagnosticar:
  ```bash
  ssh root@209.50.228.131 "docker logs shaikron-api --since=1m 2>&1 | grep DEBUG"
  ```
- Remover logs `[DEBUG]` de `apps/api/src/routes/app/profissionais.ts` após resolver

---

## 🚀 Deploy

```bash
# API + Frontend completo
ssh root@209.50.228.131 "cd /root/Matrix && git pull origin main && cd infra/docker/shaikron && docker compose build --no-cache && docker compose up -d"

# Só frontend
ssh root@209.50.228.131 "cd /root/Matrix && git pull origin main && cd infra/docker/shaikron && docker compose -f docker-compose.web.yml build --no-cache && docker compose -f docker-compose.web.yml up -d"
```

> ⚠️ Nunca usar `docker compose down --remove-orphans` — derruba o outro container.

---

## 📋 Próximos passos (ordem sugerida)

1. **Resolver redirect pós-pagamento** — polling no `BillingSuccessPage` até status `ACTIVE`
2. **Remover log de debug** do `billing.ts` linha 77
3. **Resolver bug intervalo de almoço** (debug já no lugar)
4. Dashboard real (`/app/dashboard/overview`)
5. Integrar fluxos n8n com backend completo
