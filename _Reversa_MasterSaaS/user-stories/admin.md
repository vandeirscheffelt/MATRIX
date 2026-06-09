# User Stories — Administrador
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Persona

**Admin** — operador interno da Shaikron com acesso total ao painel de gestão do MasterSaaS. Responsável por configurar produtos, campanhas, aprovar saques, gerenciar a rede de afiliados e monitorar a saúde financeira da plataforma.

---

## Épico 1 — Gestão de Produtos

### US-ADM-01 — Cadastrar produto no catálogo

**Como** admin,
**quero** cadastrar um produto SaaS com preços multi-currency e taxa de comissão,
**para que** afiliados possam promovê-lo e receber comissão automaticamente.

**Critérios de aceitação:**

```gherkin
Dado que preencho slug, nome, preços e taxa de comissão
Quando salvo o produto
Então ele aparece no catálogo de afiliados (se active = true)
E a taxa base é usada para calcular comissões quando não há promoção ativa

Dado que já existe um produto com o mesmo slug
Quando salvo
Então o produto é atualizado (upsert por slug)
E comissões já geradas mantêm seu rate_snapshot — não são afetadas

Dado que defino preços em múltiplas currencies (BRL, USD, EUR)
Quando um afiliado acessa com currency preferida USD
Então o preço exibido é o da currency USD sem conversão
```

**Cenários de borda:**
- Produto salvo sem preço em nenhuma currency → getProductPrice retorna BRL como fallback final (pode ser 0)
- Desativar produto (active = false) → links de afiliado existentes não geram novas vendas mas comissões já registradas são mantidas

---

### US-ADM-02 — Criar campanha de comissão (Promotion)

**Como** admin,
**quero** criar campanhas com override de taxa e Performance Boost por volume,
**para que** eu incentive afiliados a vender mais em períodos estratégicos.

**Critérios de aceitação:**

```gherkin
Dado que crio campanha com commissionRateOverride = 40% para "evolia-pro" de 01/07 a 31/07
Quando um afiliado realiza venda nesse período
Então a comissão é calculada com taxa 40% (não a taxa base do produto)
E rate_snapshot = 40 é gravado imutavelmente na comissão

Dado que ativo Performance Boost com minSales = 5, rateIfReached = 50%, rateIfNotReached = 35%
Quando o afiliado atinge 5 vendas na campanha
Então taxa efetiva passa a ser 50% (>= é inclusivo)
E para afiliados com < 5 vendas, taxa efetiva é 35%

Dado que a campanha termina (endDate < hoje)
Quando consulto campanhas
Então status calculado é "expired"
E vendas posteriores usam taxa base do produto

Dado que crio campanha com endDate = hoje
Quando verifico status às 23:59:59
Então campanha ainda está "active" (endDate tratado como fim do dia)
```

**Cenários de borda:**
- Dois produtos com campanhas ativas simultaneamente → cada produto resolve sua própria campanha via getActivePromotionForProduct
- Campanha criada com startDate > hoje → status "scheduled" até a data de início

---

## Épico 2 — Gestão Financeira

### US-ADM-03 — Aprovar ou rejeitar saque

**Como** admin,
**quero** revisar solicitações de saque e aprovar ou rejeitar com justificativa,
**para que** apenas saques válidos sejam processados.

**Critérios de aceitação:**

```gherkin
Dado que existe saque com status "requested"
Quando aprovo
Então status muda para "approved"
E as comissões vinculadas transitam para "processing"
E afiliado recebe notificação WhatsApp (se template configurado)

Dado que rejeito um saque com motivo "Dados bancários inválidos"
Quando o afiliado consulta seus saques
Então vê status "rejected" e o rejection_reason visível
E o saldo retorna para "available" (comissões voltam para available)

Dado que confirmo o pagamento (status → paid)
Quando o afiliado consulta
Então vê status "paid" com data de processamento
E comissões vinculadas transitam para "paid"
```

**Cenários de borda:**
- Saque aprovado mas pagamento falha → status vai para "failed" com possibilidade de retry (reprocessar)
- Rejeitar saque que já está "processing" → deve bloquear ou exigir confirmação explícita

---

### US-ADM-04 — Monitorar comissões e liberar manualmente

**Como** admin,
**quero** visualizar todas as comissões da plataforma e, se necessário, forçar transições de status,
**para que** eu resolva casos excepcionais (reembolso, erro de cálculo, disputa).

**Critérios de aceitação:**

```gherkin
Dado que acesso o painel admin de comissões
Quando filtro por status "available"
Então vejo todas as comissões prontas para saque de todos os afiliados
E posso filtrar por afiliado específico

Dado que preciso cancelar uma comissão por reembolso do cliente
Quando altero status para "canceled" com motivo "Reembolso solicitado"
Então a transição é registrada em commission_history com meu user_id e o motivo
E o saldo available do afiliado reduz proporcionalmente

Dado que uma venda paga é estornada pelo gateway
Quando altero status de "paid" para "refunded"
Então a comissão é marcada como terminal (refunded)
E commission_history registra a reversão contábil
```

**Cenários de borda:**
- Tentar transição inválida (ex: pending → paid direto) → API retorna 409 com mensagem da transição bloqueada
- CRON de liberação (`/admin/jobs/release-commissions`) roda automaticamente — admin não precisa acionar manualmente em operação normal

---

### US-ADM-05 — Visão consolidada financeira da plataforma

**Como** admin,
**quero** ver o total de comissões por status, volume de saques e liquidez necessária,
**para que** eu planeje o fluxo de caixa da plataforma.

**Critérios de aceitação:**

```gherkin
Dado que acesso o painel financeiro admin
Quando visualizo o resumo
Então vejo: total pending, total available, total processing, total paid no período
E vejo volume de saques solicitados vs aprovados vs rejeitados

Dado que seleciono um período específico
Quando filtro por mês
Então os totais refletem apenas comissões criadas naquele período
```

---

## Épico 3 — Gestão da Rede

### US-ADM-06 — Configurar regras da rede de coafiliação

**Como** admin,
**quero** definir taxa de comissão de rede, dias de elegibilidade e mínimo de vendas,
**para que** a rede de coafiliação funcione conforme a estratégia comercial atual.

**Critérios de aceitação:**

```gherkin
Dado que altero defaultRatePct de 5% para 8%
Quando um afiliado elegível recruta um novo afiliado que vende
Então a comissão de rede é calculada com 8% sobre a comissão do indicado
E comissões já geradas não são afetadas (rate_snapshot imutável)

Dado que desabilito a rede (enabled = false)
Quando um afiliado acessa a seção de rede
Então o módulo de recrutamento é ocultado ou desabilitado
E nenhuma nova comissão de rede é gerada

Dado que altero eligibilityDays para 60 e minSalesRequired para 3
Quando verifico elegibilidade de um afiliado com 2 vendas nos últimos 60 dias
Então isReferralEligible retorna false
```

---

### US-ADM-07 — Criar campanha de recrutamento

**Como** admin,
**quero** criar campanhas temporárias com taxas e elegibilidade diferenciadas para a rede,
**para que** eu acelere o recrutamento de novos afiliados em momentos estratégicos.

**Critérios de aceitação:**

```gherkin
Dado que crio campanha de recrutamento com ratePctOverride = 10% de 01/07 a 15/07
Quando resolveNetworkRules é chamado durante o período
Então retorna ratePct = 10% e fromCampaign preenchido com a campanha
E a taxa base (defaultRatePct) é ignorada durante a campanha

Dado que a campanha expira
Quando resolveNetworkRules é chamado após endDate
Então retorna as regras base sem fromCampaign
```

---

## Épico 4 — Gestão de Conteúdo

### US-ADM-08 — Gerenciar tutoriais

**Como** admin,
**quero** criar, editar e reordenar tutoriais por categoria,
**para que** afiliados tenham conteúdo de capacitação atualizado.

**Critérios de aceitação:**

```gherkin
Dado que crio tutorial com youtubeUrl = "https://youtu.be/xYz123abcDE"
Quando o tutorial é salvo
Então youtubeId = "xYz123abcDE" é extraído automaticamente
E o vídeo é exibido corretamente no player

Dado que marco tutorial como required = true
Quando afiliado novo acessa o checklist de onboarding
Então esse tutorial aparece como obrigatório

Dado que desativo um tutorial (active = false)
Quando afiliado acessa a lista
Então o tutorial não aparece (filtrado por active = true)
```

**Cenários de borda:**
- URL no formato watch?v=, youtu.be/, embed/, shorts/ e bare ID (11 chars) — todos devem ser extraídos corretamente
- Tutorial com order duplicado → ordenação por insertion order como desempate

---

## Épico 5 — WhatsApp e Notificações

### US-ADM-09 — Configurar templates de notificação WhatsApp

**Como** admin,
**quero** configurar templates de mensagem para eventos do sistema,
**para que** afiliados recebam notificações automáticas em momentos chave.

**Critérios de aceitação:**

```gherkin
Dado que crio template para evento "commission_available" com corpo "Ola {{1}}, sua comissao de R$ {{2}} foi liberada!"
Quando uma comissão transita de pending para available
Então a mensagem é enviada ao afiliado com variáveis preenchidas

Dado que desativo um template (active = false)
Quando o evento ocorre
Então nenhuma mensagem é enviada para aquele evento

Dado que acesso o status da conexão WhatsApp
Quando o painel carrega
Então vejo o status (connected / disconnected / pending_qr / error)
E se status = pending_qr, vejo o QR code para escanear
```

**Cenários de borda:**
- Mensagens com acentos → usar apenas ASCII nas strings enviadas ao WhatsApp (Evolution API double-encodes acentos)
- Conexão cai durante envio → evento é reprocessado ou entra em fila de retry (definir na implementação)

---

## Épico 6 — Monitoramento

### US-ADM-10 — Monitorar alertas da plataforma

**Como** admin,
**quero** ver alertas proativos globais da plataforma,
**para que** eu identifique e reaja a anomalias rapidamente.

**Critérios de aceitação:**

```gherkin
Dado que um afiliado concentra >= 25% da receita recente
Quando acesso alertas com scope "global"
Então vejo alerta "top affiliate concentration" de severidade "warning"
E posso navegar para o perfil do afiliado via action.to

Dado que uma campanha expira em <= 3 dias
Quando consulto alertas com scope "campaigns"
Então vejo alerta com severidade "warning" e nome da campanha

Dado que não há nenhuma condição anômala
Quando consulto alertas
Então a lista retorna vazia (sem alertas falso-positivos)
```

---

## Resumo de cobertura

| US | Módulos cobertos | Complexidade |
|----|-----------------|--------------|
| US-ADM-01 | products, commissions | Média |
| US-ADM-02 | promotions, commissions | Alta |
| US-ADM-03 | withdrawals-payout, commissions | Alta |
| US-ADM-04 | commissions | Alta |
| US-ADM-05 | finance-admin | Média |
| US-ADM-06 | network | Média |
| US-ADM-07 | network | Média |
| US-ADM-08 | tutorials | Baixa |
| US-ADM-09 | whatsapp-integration | Média |
| US-ADM-10 | smart-alerts | Média |
