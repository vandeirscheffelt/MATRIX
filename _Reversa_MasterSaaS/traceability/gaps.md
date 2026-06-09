# Catálogo de Lacunas — MasterSaaS
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado
> Input para o Revisor — cada lacuna deve ser resolvida ou explicitamente aceita antes da implementação.

---

## Como usar este catálogo

Cada lacuna tem:
- **Confiança da spec** — o quanto sabemos sobre o comportamento esperado
- **Impacto** — consequência de implementar sem resolver
- **Resolução sugerida** — ação concreta para fechar o gap

Lacunas marcadas com 🔴 bloqueiam a implementação do módulo. As 🟡 geram risco técnico. As ⚪ são decisões de produto adiáveis.

---

## Segurança

### GAP-SEC-01 — Token WhatsApp em localStorage
**Módulo:** `whatsapp-integration`
**Confiança da spec:** 🔴 Baixa
**Impacto:** Token de acesso à Evolution API exposto ao cliente → qualquer script injetado pode exfiltrar o token e controlar o número WhatsApp da empresa.
**Resolução:** Mover token para variável de ambiente server-side. Chamadas à Evolution API devem passar por backend próprio (proxy Fastify), nunca direto do browser.

---

### GAP-SEC-02 — Dados financeiros do afiliado em localStorage
**Módulo:** `finance-affiliate`
**Confiança da spec:** 🔴 Baixa
**Impacto:** Saldo, comissões e histórico de saques de um afiliado ficam persistidos no dispositivo. Em computadores compartilhados, outro usuário pode acessar os dados.
**Resolução:** Remover persistência local de dados financeiros. Carregar via API com RLS por `affiliate_id` (Supabase Row Level Security).

---

### GAP-SEC-03 — Ausência de RLS em tabelas a criar
**Módulo:** todos (commissions, sales, withdrawals, promotions)
**Confiança da spec:** 🟡 Média
**Impacto:** Sem RLS, qualquer usuário autenticado pode ler/escrever dados de outros afiliados via Supabase client direto.
**Resolução:** Toda tabela nova deve ter RLS habilitado. Afiliado só acessa rows onde `affiliate_id = auth.uid()`. Admin acessa via service_role key (backend).

---

## Lógica de Negócio

### GAP-BIZ-01 — Rota `/r/:userId/:slug` ausente no código ✅ FECHADO
**Decisão (2026-06-08):** Implementar. Rota server-side que:
1. Recebe `code` e `slug`
2. Persiste atribuição (cookie 14d + localStorage como fallback)
3. Redireciona para `productUrl` com `src=MASTERSAAS|AFIL|{code}|{productCode}`

---

### GAP-BIZ-02 — `setAffiliateParent` (cookie 14d) não encontrado
**Módulo:** `referral-tracking`
**Confiança da spec:** 🟡 Média — mencionado no blueprint, ausente no código
**Impacto:** Atribuição de venda a afiliado pode ser perdida se usuário demorar mais de uma sessão para comprar.
**Resolução:** Implementar cookie HttpOnly de 14 dias no servidor ao processar `/r/:code/:slug`. Cookie deve sobreviver a fechamento de browser e ser lido no momento do checkout.

---

### GAP-BIZ-03 — `productUrl` e `productCode` ausentes no tipo `Product`
**Módulo:** `products`, `referral-tracking`
**Confiança da spec:** 🟡 Média — campos mencionados no blueprint, ausentes no tipo TypeScript
**Impacto:** Sem `productUrl`, não há destino para o link de afiliado. Sem `productCode`, o parâmetro `src` fica incompleto.
**Resolução:** Adicionar campos ao schema de `Product` antes de qualquer implementação de backend. Confirmar com o usuário o formato exato de `productCode` (ex: `EVOLIA-PRO` vs `evolia_pro`).

---

### GAP-BIZ-04 — CRON de liberação de comissões ✅ FECHADO
**Decisão (2026-06-08):** Usar **pg_cron** (extensão Supabase) como solução primária.
**Motivo:** com volume alto de afiliados, o UPDATE roda dentro do banco sem hop de rede — mais confiável e performático que n8n para operações de banco em escala. n8n pode ser usado como monitor/alerta do job, não como executor.

**Implementação:**
```sql
-- Habilitar pg_cron no Supabase (extensions)
SELECT cron.schedule(
  'release-commissions',
  '0 3 * * *',   -- todo dia às 03:00 UTC
  $$
    WITH released AS (
      UPDATE mastersaas.commissions
      SET status = 'available', available_at = NOW()
      WHERE status = 'pending' AND hold_until < NOW()
      RETURNING id, affiliate_id, commission
    )
    INSERT INTO mastersaas.commission_history (commission_id, from_status, to_status, changed_at)
    SELECT id, 'pending', 'available', NOW() FROM released;
  $$
);
```
**Escala:** uma query UPDATE com índice em `(status, hold_until)` suporta milhões de rows sem degradação.

---

### GAP-BIZ-05 — Schema real de `sales` + origem dos registros ✅ FECHADO
**Decisão (2026-06-08):**
- Schema único `mastersaas.*` para todas as tabelas
- **Fluxo de venda:** LIADS aciona checkout (Stripe ou AppMax) → gateway dispara webhook → MasterSaaS cria `mastersaas.sales` + `mastersaas.commissions` → MasterSaaS notifica LIADS que popula campanha e LIAS
- **Dado crítico a capturar no checkout:** número de telefone do comprador (campo `phone` em `sales`)
- **Campos obrigatórios em `mastersaas.sales`:** `id`, `affiliate_id`, `product_slug`, `revenue`, `currency`, `gateway` (stripe|appmax), `gateway_payment_id`, `phone`, `created_at`

---

### GAP-BIZ-06 — Comissão de rede: quando exatamente é gerada? ✅ FECHADO
**Decisão (2026-06-08):** Comissão de rede gerada no momento da venda, com status `pending`. Fica visível no painel do recrutador mas bloqueada para saque durante os 30 dias de holding. CRON diário libera junto com a comissão direta. Elegibilidade do recrutador verificada no momento da venda.
**Impacto na implementação:** A tabela `commissions` comporta ambos os tipos — adicionar campo `type: 'direct' | 'network'` para distinguir. FK `parent_commission_id` opcional aponta para a comissão direta que originou a comissão de rede.

---

### GAP-BIZ-07 — Reversão de comissão em caso de reembolso
**Módulo:** `commissions`
**Confiança da spec:** 🟡 Média — mencionado no SDD, mecanismo não definido
**Impacto:** Se cliente pede reembolso após comissão estar `paid`, como o sistema registra o débito? Cria uma comissão negativa? Apenas muda status para `refunded`?
**Resolução:** Definir modelo contábil: (a) apenas mudar status para `refunded` sem débito, ou (b) criar entrada negativa em `commission_history` para rastreamento contábil preciso.

---

### GAP-BIZ-08 — Payout de afiliados ✅ FECHADO
**Decisão (2026-06-08):** Operação manual na fase inicial.
**Fluxo:** Admin aprova saque no MasterSaaS → envia PIX da conta da empresa para o afiliado → marca como `paid` no painel (preenche `payment_id` com ID da transferência para rastreabilidade).
**Gateways mantidos:** Stripe (recebimento internacional) + AppMax (recebimento Brasil) — ambos permanecem por ora.
**Evolução futura:** quando o volume de saques justificar, integrar Asaas para PIX programático automático. O schema já está preparado — basta implementar o webhook de confirmação que preenche `payment_id` e atualiza `status → paid` automaticamente.

---

### GAP-BIZ-09 — Progresso de tutoriais sem backend
**Módulo:** `tutorials`
**Confiança da spec:** 🟡 Média
**Impacto:** Progresso de onboarding (tutoriais assistidos, checklist) fica em localStorage — perdido ao trocar de dispositivo ou limpar dados do browser.
**Resolução:** Criar tabela `tutorial_progress` com `(affiliate_id, tutorial_id, watched_at)` e sincronizar com backend. Prioritário para o fluxo de onboarding.

---

### GAP-BIZ-10 — `admin.finance.tsx` (1.710 LOC) parcialmente analisado
**Módulo:** `finance-admin`
**Confiança da spec:** 🟡 Média
**Impacto:** Arquivo mais complexo do projeto pode conter regras de negócio não documentadas — cálculos de relatórios, filtros avançados, lógica de payout em batch.
**Resolução:** Executar `reversa-archaeologist` especificamente sobre `admin.finance.tsx` antes de implementar o módulo finance-admin no backend.

---

## Decisões de Produto Confirmadas

### GAP-PROD-COAF-01 — Dois caminhos de entrada para coafiliado ✅ FECHADO
**Decisão (2026-06-08):** Coafiliado pode ser recrutado por dois caminhos:
1. **Via link de recrutamento** (`/join/:code`) — qualquer pessoa que se cadastra usando o link do afiliado
2. **Via conversão de cliente** — pessoa que comprou um produto via link de afiliado (`/r/:code/:slug`) e posteriormente se torna vendedora/afiliada

Em ambos os casos, o vínculo é o mesmo: `referred_by_id` no perfil aponta para o recrutador. O sistema não precisa distinguir o caminho de entrada — apenas garantir que o `referred_by_id` seja registrado corretamente em ambos os fluxos.

**Impacto na implementação:**
- Fluxo 1 (já implementado): `/join/:code` → `referral-storage.ts` captura o código → trigger `handle_new_user` resolve `referred_by_id` no signup
- Fluxo 2 (a implementar): ao processar `/r/:code/:slug`, além de persistir para atribuição de venda, o `code` deve ser também salvo como `referred_by_code` para uso no eventual signup posterior do visitante

---

## Produto / Decisões Abertas

### GAP-PROD-01 — Multinível de rede: 1 nível agora, quantos no futuro?
**Módulo:** `network`
**Confiança da spec:** ⚪ Decisão de produto
**Impacto:** O schema atual suporta apenas 1 nível (`referred_by_id` direto no perfil). Multinível exige tabela de adjacência ou closure table.
**Resolução:** Confirmar roadmap: o MasterSaaS vai além de 1 nível? Se sim, implementar schema preparado para multinível desde o início (closure table). Se não, documentar explicitamente o limite.

---

### GAP-PROD-02 — Módulo de reports sem spec
**Módulo:** `reports`
**Confiança da spec:** 🔴 Baixa — rota existe, conteúdo não analisado
**Impacto:** `admin.reports.tsx` pode conter agregações complexas (métricas por período, por afiliado, por produto) que requerem queries otimizadas no backend.
**Resolução:** Analisar `admin.reports.tsx` com o Arqueólogo antes de especificar o backend de relatórios.

---

### GAP-PROD-03 — News sem spec dedicada
**Módulo:** `tutorials-news`
**Confiança da spec:** ⚪ Decisão de produto
**Impacto:** Notícias cobertas apenas parcialmente no SDD de tutorials. Pode ter lógica própria de publicação, categorização e exibição.
**Resolução:** Se news for feature relevante, criar SDD dedicado. Se for simples CRUD admin, incluir no OpenAPI como extensão de `/tutorials`.

---

### GAP-PROD-04 — i18n sem spec (pt/en/es)
**Módulo:** `i18n-currency`
**Confiança da spec:** ⚪ Decisão de produto
**Impacto:** ~2.400 chaves de tradução em 3 idiomas. Sem spec, o backend pode retornar textos em hardcode no idioma errado.
**Resolução:** Definir estratégia: (a) i18n só no frontend (atual), ou (b) backend retorna chaves e frontend traduz, ou (c) backend retorna textos já traduzidos. A escolha afeta o contrato da API.

---

### GAP-PROD-05 — Dashboard do afiliado sem SDD
**Módulo:** `dashboard`
**Confiança da spec:** ⚪ Decisão de produto
**Impacto:** Página principal (`/`) composta de widgets de vários módulos. Sem spec, o backend não sabe quais agregações expor em um único endpoint de dashboard.
**Resolução:** Definir se o dashboard vai ter endpoint dedicado (`GET /dashboard/summary`) ou montar dados no frontend via múltiplas chamadas paralelas.

---

## Resumo por Prioridade

### 🔴 Bloqueadores em aberto

| Gap | Módulo | Status |
|-----|--------|--------|
| GAP-SEC-01 | Token WhatsApp em localStorage | ⏳ aberto |
| GAP-SEC-02 | Dados financeiros em localStorage | ⏳ aberto |
| GAP-BIZ-01 | Rota `/r/:userId/:slug` ausente | ✅ fechado — implementar |
| GAP-BIZ-04 | CRON de liberação de comissões | ⏳ aberto |
| GAP-BIZ-06 | Momento de geração da comissão de rede | ✅ fechado — no momento da venda |
| GAP-BIZ-08 | Payout de afiliados | ✅ fechado — manual → Asaas futuro |
| GAP-PROD-02 | `admin.reports.tsx` não analisado | ⏳ aberto |

### 🟡 Risco técnico em aberto

| Gap | Módulo | Status |
|-----|--------|--------|
| GAP-SEC-03 | RLS nas tabelas a criar | ⏳ aberto |
| GAP-BIZ-02 | Cookie de atribuição 14d | ⏳ aberto |
| GAP-BIZ-03 | `productUrl`/`productCode` ausentes | ⏳ aberto |
| GAP-BIZ-05 | Schema único `mastersaas.*` | ✅ fechado — schema `mastersaas` |
| GAP-BIZ-07 | Modelo contábil de reembolso | ⏳ aberto |
| GAP-BIZ-09 | Progresso de tutoriais sem backend | ⏳ aberto |
| GAP-BIZ-10 | `admin.finance.tsx` parcialmente analisado | ⏳ aberto |

### ⚪ Decisões de produto (adiáveis)

| Gap | Módulo | Status |
|-----|--------|--------|
| GAP-PROD-COAF-01 | Dois caminhos de entrada do coafiliado | ✅ fechado |
| GAP-PROD-01 | Multinível de rede | ⏳ aberto |
| GAP-PROD-03 | News sem spec dedicada | ⏳ aberto |
| GAP-PROD-04 | Estratégia de i18n no backend | ⏳ aberto |
| GAP-PROD-05 | Dashboard sem SDD | ⏳ aberto |
