# Domain — MasterSaaS
> Gerado pelo Detetive (Reversa v1.2.14) — 2026-06-08
> 🟢 CONFIRMADO | 🟡 INFERIDO | 🔴 LACUNA

---

## Glossário de Domínio

| Termo | Definição | Confiança |
|-------|-----------|-----------|
| **Afiliado** | Usuário cadastrado que promove produtos SaaS via links rastreáveis e recebe comissões por vendas | 🟢 |
| **Admin** | Usuário com acesso total ao painel administrativo — gerencia produtos, comissões, saques e conteúdo | 🟢 |
| **Lead / Visitante** | Pessoa que acessa via link de afiliado ou convite, antes do cadastro | 🟢 |
| **Affiliate Code** | Código único de 8 chars (alfanumérico sem ambíguos) gerado no cadastro — imutável | 🟢 |
| **Link de Afiliado** | `{baseUrl}/r/{code}/{productSlug}` — todo tráfego rastreado passa por aqui | 🟢 |
| **Link de Convite** | `{baseUrl}/join/{code}` — recruta novos afiliados para a rede | 🟢 |
| **Atribuição** | Vínculo entre uma venda e um afiliado — regra first-click, 14 dias | 🟢 |
| **Comissão** | Valor gerado por uma venda atribuída — `revenue × commissionRate` — snapshot imutável | 🟢 |
| **Comissão Recorrente** | Comissão gerada mensalmente enquanto assinatura ativa e dentro da duração | 🟡 |
| **Comissão de Rede** | 5% das comissões dos indicados, pago ao indicador se elegível | 🟢 |
| **Holding Window** | 30 dias de espera após a venda antes de comissão virar `available` | 🟡 |
| **Coafiliado** | Afiliado recrutado por outro afiliado via `/join/:code` | 🟢 |
| **Indicador / Referrer** | Afiliado que trouxe outro afiliado para a rede — recebe comissão de rede | 🟢 |
| **Elegibilidade de Rede** | Condição para receber comissão de rede: ≥1 venda pessoal nos últimos 30 dias | 🟢 |
| **Performance Boost** | Mecanismo de promoção com duas taxas: uma se afiliado atinge meta, outra se não | 🟢 |
| **Saque / Withdrawal** | Solicitação de transferência do saldo disponível para conta bancária/PIX | 🟢 |
| **Payout em Lote** | Pagamento simultâneo de até 50 saques pelo admin | 🟡 |
| **Auto-Hide Saldo** | Saldo oculto automaticamente após 30s de inatividade (modo privacidade) | 🟢 |
| **Sales Copy** | Textos de vendas por produto com mensagens A/B, público-alvo e passos de ação | 🟢 |
| **Promoção Guiada** | Modal com roteiro de abordagem incluindo public-alvo, scripts e passos | 🟢 |
| **src** | Parâmetro de rastreamento injetado na URL do produto: `MASTERSAAS\|AFIL\|{ref}\|{productCode}` | 🟢 |
| **News Guidance Rail** | Banners de orientação na dashboard filtrados por `displayLocation` | 🟢 |
| **Growth Engine** | Widget da dashboard com métricas de crescimento: clicks/mês, vendas/mês, cliques desde última conversão | 🟢 |
| **MRR** | Monthly Recurring Revenue — soma das comissões mensais das assinaturas ativas | 🟢 |
| **At-risk** | Assinatura com pagamento em atraso ou risco de cancelamento | 🟢 |
| **Smart Alerts** | Sistema de alertas proativos derivados do dataset — sem configuração manual | 🟢 |

---

## Regras de Negócio Centrais

### RN-01 — Atribuição First-Click 🟢
O primeiro afiliado a gerar o clique é o atribuído. Nenhum clique posterior sobrescreve.
- Persistência: localStorage (`ref_code`) — sem expiração explícita no código
- Cookie de afiliado (`PARENT_COOKIE_DAYS = 14`): 🔴 não encontrado no código
- Atribuição do indicador (`referred_by_id`): imutável após primeiro set no banco

### RN-02 — Auto-Referência Bloqueada 🟢
Trigger `handle_new_user` verifica `inviter_id = new.id` e anula se verdadeiro.
Extensão necessária: bloquear auto-compra (mesmo customer_hash que o afiliado).

### RN-03 — Snapshot de Comissão 🟡
Taxa de comissão capturada no momento da venda. Alterações futuras no produto ou promoção não afetam comissões já geradas.

### RN-04 — Holding de 30 Dias 🟡
Comissão nasce `pending`. Só vira `available` após 30 dias da venda.
Hoje: transição em `useEffect` client-side — 🔴 deve ser CRON diário às 00:05 UTC.

### RN-05 — Elegibilidade de Rede 🟢
```
isReferralEligible = lastSaleAt != null
                   AND recentSalesCount >= minSalesRequired (default: 1)
                   AND daysSinceLastSale <= eligibilityDays (default: 30)
```
Se inelegível: comissão de rede não é creditada (sem retroatividade).

### RN-06 — Performance Boost 🟢
```
effectiveRate = if (performanceEnabled):
  affiliateSalesInCampaign >= performanceMinSales
    ? performanceRateIfReached
    : performanceRateIfNotReached
else:
  commissionRateOverride
```
🔴 Política retroativa vs prospectiva não definida no código — decisão pendente de produto.

### RN-07 — Promoção Guiada visível apenas quando ativa 🟡
Botão de promoção guiada aparece apenas para produtos com promoção `Active`.
Commit `ecdf156` — "Enforced default promo button" — sugere que havia um comportamento anterior diferente.

### RN-08 — Promoções movidas para Admin 🟢
Commit `38edd8f` — "Moved Promoções to Admin" — decisão explícita de que CRUD de promoções é operação administrativa, não self-service do afiliado.

### RN-09 — Saldo escondido por privacidade 🟢
Auto-hide em 30s após última interação (commit `90e42c0` — "Added privacy mode auto-hide").
Toggle manual disponível. Persist: 🔴 não confirmado se vai para localStorage.

### RN-10 — Withdrawal validation 🟢
Commit `90ec77d` — "Added withdrawal validation" — validações server-side necessárias:
- Valor ≥ mínimo (🔴 valor mínimo não definido no código)
- Valor ≤ `availableBalance`
- `canConfirm` checkbox obrigatório na UI

### RN-11 — Comissão de rede é 5% das comissões, não da receita 🟢
`REFERRAL_RATE = 0.05` — aplicado sobre `commission`, não sobre `revenue`.
```
referral_commission = sale.commission * REFERRAL_RATE
```

### RN-12 — Renamed Approved → Processing 🟢
Commit `3284e19` — decisão explícita de renomear status `approved` para `processing` no frontend.
Implicação: o estado intermediário entre "liberado" e "pago" é nomeado `processing`, não `approved`.

### RN-13 — Diploma de afiliado = `affiliate_code` 🟢
O `affiliate_code` é a identidade pública do afiliado — exibida, copiada, usada em links. É gerada automaticamente e nunca pode ser alterada.

### RN-14 — Referral vínculo single-shot 🟢
`referred_by_id` só pode ser gravado uma vez (trigger `profiles_prevent_immutable_changes`). Mesmo que o usuário acesse `/join/OUTRO_CODIGO` depois de autenticado, o vínculo não muda.

### RN-15 — Progresso de tutorial por vídeo 🟢
Commit `0099955` — "Added watched tracking per video" — progresso granular por vídeo individual, não por categoria. Migrado para dentro de Tutoriais (commit `70e2a79` — "Moved Affiliate Progress to Tutorials").

### RN-16 — Produtos persistidos em localStorage 🟢
Commit `60f5acf` — "Persisted products to localStorage" — decisão consciente de usar LS como persistência temporária antes do backend.

### RN-17 — i18n com SSR hydration bug corrigido 🟢
Commit `860811f` — "Fixed i18n SSR hydration bug" — indica que houve problema de mismatch entre server e client render para i18n. Currency e locale devem ser resolvidos server-side para evitar flash.

### RN-18 — Moedas duplicadas bloqueadas no produto 🟢
Commit `b88e82e` — "Blocked duplicate currencies" — cada produto só pode ter um preço por moeda.

---

## Linha do Tempo de Decisões (Git)

| Data | Commit | Decisão |
|------|--------|---------|
| 2026-04-17 | `90e5e44` | Criação do portal MasterSaaS |
| 2026-04-18 | `7cf23b8` | Produtos e perfil adicionados |
| 2026-04-18 | `1a97dfc` | Vendas e Financeiro adicionados |
| 2026-04-19 | `7525994` | Multi-currency pricing implementado |
| 2026-04-19 | `60f5acf` | Produtos persistidos em localStorage |
| 2026-04-19 | `6dc3b7d` | Rede de afiliados adicionada |
| 2026-04-19 | `55f946f` | Sales Copy estruturado |
| 2026-04-20 | `0c4430c` | Pricing dinâmico por moeda |
| 2026-04-20 | `8c2ef2b` | Fallback currency por produto |
| 2026-04-20 | `3284e19` | **Renomeou Approved → Processing** |
| 2026-04-21 | `41d643b` | Performance Boost rules adicionado |
| 2026-04-21 | `516c1f6` | Admin finance page criada |
| 2026-04-21 | `38edd8f` | **Promoções movidas para Admin** |
| 2026-04-21 | `0c089d1` | **Habilitou Cloud + ref-tracking** (Supabase Auth real) |
| 2026-04-21 | `ad2df40` | Payment workflow + audit adicionado |
| 2026-04-22 | `2c6db16` | **Google OAuth + OTP adicionados** |
| 2026-04-22 | `90e42c0` | Privacy mode auto-hide |
| 2026-04-23 | `ca192d7` | Sistema de alertas implementado |
| 2026-04-24 | `08da7e4` | WhatsApp provider UI (Meta + Evolution) |
| 2026-04-25 | `8e8964d` | Sistema de progresso de afiliado |
| 2026-04-25 | `0099955` | Tracking por vídeo individual |
