# Shaikron — STATUS

> ⚠️ **AVISO DE REBRANDING (Evolia by Shaikron)**
> O produto final para o cliente foi oficialmente renomeado para **Evolia**. 
> Toda a identidade visual (textos, títulos, mensagens) no frontend exibe o nome "Evolia". Porém, a infraestrutura (pastas, repositórios, webhooks, imagens docker, schema do banco) se mantém com o nome técnico **Shaikron** para evitar quebra de integrações legadas de faturamento e infra. O modelo é de uma Holding (Shaikron) com um Produto (Evolia).

**Última atualização:** 2026-05-17

---

## ✅ O que está funcionando

- **Redirect pós-pagamento**: polling no `BillingSuccessPage` aguarda status `ACTIVE` antes de redirecionar
- **Log de debug removido**: `billing.ts` e `appmax-provider.ts` limpos
- **Bug intervalo de almoço resolvido**: dados chegam corretamente no banco



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

## ⚠️ Pendências em aberto

### 🔴 Dívida Técnica — Isolamento de dados da IA02 (segurança)

**Contexto:** A IA02 (secretária interna) hoje usa uma única instância n8n com restrições apenas em nível de prompt. Isso significa que um profissional com acesso ao chat poderia, em tese, visualizar ou modificar dados de outros profissionais da mesma empresa via jailbreak ou alucinação do LLM.

**Risco:** Alto para operação em escala (200k+ leads, múltiplas empresas). Potencial violação de LGPD entre profissionais de uma mesma empresa.

**Solução planejada (duas camadas):**

1. **Fork do workflow n8n** — criar IA02-Profissional separado onde os tool nodes de escrita (bloquear, cancelar, reagendar) usam `profissionalId` fixo do contexto verificado (`$('Dados IA02').first().json.profissionalId`) em vez de `$fromAI()`. O `ver_agenda` também recebe `profissionalId` fixo — profissional não consegue ver agenda de outros.

2. **Backend enforcement** — nos endpoints `/webhook/n8n/bloquear`, `/cancelar`, `/reagendar`: validar explicitamente que o `profissionalId` recebido pertence à `empresaId` do contexto. Impede que empresa A opere sobre profissionais da empresa B mesmo com requisição direta à API.

**Decisão:** Implementar após estabilização e testes completos dos tools da IA02 atuais.

---

### 🟡 Dívida Técnica — Seleção justa de profissional (IA02/IA03)

**Contexto:** Ao sugerir horários disponíveis, a IA tende a privilegiar o mesmo profissional repetidamente (ex: Eduardo aparece antes de Aroldo por ordem de resposta da query). Em testes, o Aroldo só foi sugerido porque Eduardo estava bloqueado — não por critério de equidade.

**Risco:** Médio. Em escala, um profissional recebe desproporcionalmente mais agendamentos do que outros da mesma equipe.

**Solução planejada:**
- Agente especialista de distribuição de agenda (skill dedicada)
- Ao buscar slots disponíveis, ordenar profissionais por número de agendamentos no período (ASC) — menor agenda tem prioridade
- Alternativa simples: round-robin por `profissionalId` com estado no Redis por `empresaId`

**Decisão:** Implementar como task do agente especialista quando os tools básicos estiverem estáveis.

---

### 🟡 Dívida Técnica — Injeção automática de telefone do cliente (IA01 → n8n)

**Contexto:** Quando um cliente agenda via WhatsApp (IA01), o n8n já tem o número de telefone do remetente (`body.data.key.remoteJid`). Porém esse telefone não é injetado automaticamente no agendamento — a IA03 pode acabar pedindo o telefone que o cliente já forneceu simplesmente por estar conversando.

**Solução planejada:**
- No node de criação de agendamento (tool `criar_agendamento` via IA03), o n8n injeta `clienteTelefone` extraído de `$('Webhook EVO').item.json.body.data.key.remoteJid` (normalizado, sem `@s.whatsapp.net`)
- Campo fica disponível no contexto do agendamento sem precisar perguntar ao cliente

**Decisão:** Implementar ao construir a IA03 (agenda inteligente).

---

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

## 📋 Próximos passos

1. **Integração n8n** — conectar fluxos de automação (agendamentos, notificações, WhatsApp) com o backend
