# User Stories — Afiliado
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Persona

**Afiliado** — usuário cadastrado no MasterSaaS que promove produtos do catálogo Shaikron/Evolia em troca de comissões. Pode ser recrutador de outros afiliados (coafiliação).

---

## Épico 1 — Entrada no Ecossistema

### US-AF-01 — Cadastro via link de indicação

**Como** visitante que recebeu um link `/join/{code}`,
**quero** me cadastrar e ser automaticamente vinculado ao afiliado que me indicou,
**para que** ele receba comissão de rede pelas minhas futuras vendas.

**Critérios de aceitação:**

```gherkin
Dado que acesso /join/JOAO1234
Quando o sistema captura e normaliza o código (UPPERCASE, alfanumérico, max 16 chars)
Então o código é persistido em localStorage (chave ref_code)
E ao concluir o cadastro, referred_by_id é resolvido pelo trigger handle_new_user
E ref_code é limpo do localStorage após signup bem-sucedido

Dado que o código do link é o mesmo que o meu próprio affiliate_code
Quando tento me cadastrar
Então auto-referência é bloqueada pelo trigger
E referred_by_id permanece null

Dado que o link de indicação é inválido (código inexistente)
Quando acesso /join/INVALIDO e tento me cadastrar
Então o cadastro prossegue normalmente sem referred_by_id
```

**Cenários de borda:**
- Link acessado em browser sem localStorage (modo privativo sem acesso) → cadastro sem referral, sem erro visível
- Usuário acessa múltiplos links de indicação antes do cadastro → apenas o último código capturado é usado

---

### US-AF-02 — Cadastro direto (sem indicação)

**Como** visitante,
**quero** me cadastrar com email+senha, OTP magic-link ou Google,
**para que** eu acesse o painel de afiliado e comece a promover produtos.

**Critérios de aceitação:**

```gherkin
Dado que preencho email e senha (mínimo 6 chars)
Quando confirmo o cadastro
Então perfil é criado automaticamente com affiliate_code único de 8 chars alfanuméricos
E sou redirecionado ao painel principal

Dado que já tenho conta e acesso /signup ou /login autenticado
Quando o sistema detecta sessão ativa
Então sou redirecionado para / sem reexibir o formulário

Dado que solicito OTP e digito token de 6 dígitos correto
Quando verifico o OTP
Então faço login com sucesso e perfil é carregado

Dado que digito token OTP incorreto ou expirado
Quando verifico o OTP
Então recebo mensagem de erro e posso solicitar novo token
```

**Cenários de borda:**
- fetchProfile chamado via setTimeout(0) para evitar deadlock Supabase — perfil pode chegar 1 tick após sessão
- Senha com exatamente 6 chars deve ser aceita; 5 chars deve ser rejeitada

---

## Épico 2 — Promoção de Produtos

### US-AF-03 — Visualizar catálogo de produtos

**Como** afiliado,
**quero** ver todos os produtos disponíveis para promover com suas taxas e preços,
**para que** eu escolha o que promover com base na comissão e no apelo ao meu público.

**Critérios de aceitação:**

```gherkin
Dado que acesso a tela de produtos
Quando o catálogo carrega
Então vejo apenas produtos com active = true
E cada produto exibe: nome, preço na minha currency preferida, taxa de comissão base e duração

Dado que há promoção ativa para um produto
Quando visualizo esse produto
Então vejo a taxa efetiva da promoção (commissionRateOverride ou taxa base)
E se Performance Boost estiver ativo, vejo a taxa máxima alcançável e o threshold de vendas

Dado que prefiro ver preços em USD
Quando seleciono USD como currency
Então os preços são resolvidos na ordem: USD > fallback > BRL
```

**Cenários de borda:**
- Produto sem preço na currency preferida → exibir em BRL com indicação da moeda
- Produto sem commissionRate definido → exibir "taxa a definir" ou ocultar

---

### US-AF-04 — Obter link de afiliado

**Como** afiliado,
**quero** gerar meu link personalizado para cada produto,
**para que** eu rastreie as vendas atribuídas a mim.

**Critérios de aceitação:**

```gherkin
Dado que visualizo um produto
Quando clico em "Copiar link"
Então recebo o link no formato {baseUrl}/r/{meu_code}/{productSlug}
E posso copiar para a área de transferência com um clique

Dado que quero meu link geral de indicação de membros
Quando acesso a seção de rede
Então recebo o link no formato {baseUrl}/join/{meu_code}
```

**Cenários de borda:**
- affiliate_code ainda não carregado (perfil em loading) → botão de copiar desabilitado

---

## Épico 3 — Acompanhamento Financeiro

### US-AF-05 — Ver resumo de comissões

**Como** afiliado,
**quero** ver meu saldo disponível, pendente, total ganho e total pago,
**para que** eu saiba quanto posso sacar e quanto estou acumulando.

**Critérios de aceitação:**

```gherkin
Dado que acesso minha área financeira
Quando a tela carrega
Então vejo: saldo disponível, saldo em holding (pendente), total ganho histórico, total pago

Dado que tenho comissões com hold_until > hoje
Quando visualizo o painel
Então essas comissões aparecem como "pendente" com data prevista de liberação

Dado que uma comissão passou de pending para available (via CRON)
Quando atualizo o painel
Então o saldo disponível aumenta e o pendente diminui correspondentemente
```

**Cenários de borda:**
- Saldo disponível = 0 e saldo pendente = 0 → exibir estado vazio com CTA para promover produtos

---

### US-AF-06 — Solicitar saque

**Como** afiliado com saldo disponível >= R$ 100,
**quero** solicitar um saque informando chave PIX ou conta bancária,
**para que** receba minha comissão.

**Critérios de aceitação:**

```gherkin
Dado que tenho R$ 500 disponíveis e nenhum saque pendente
Quando solicito saque de R$ 300 com chave PIX
Então saque é criado com status "requested"
E saldo disponível reduz para R$ 200
E recebo confirmação na tela

Dado que o valor solicitado é menor que R$ 100
Quando tento solicitar
Então vejo mensagem: "Valor mínimo para saque é R$ 100"
E o saque não é criado

Dado que já tenho um saque com status "requested" ou "processing"
Quando tento criar outro saque
Então vejo mensagem: "Você já tem um saque em andamento"

Dado que o saque é aprovado pelo admin
Quando consulto meus saques
Então vejo status atualizado para "approved" e depois "paid"
```

**Cenários de borda:**
- Saque rejeitado pelo admin → exibir `rejection_reason` na listagem
- Saldo exatamente R$ 100 → deve permitir saque (valor mínimo é inclusivo)

---

### US-AF-07 — Ver histórico de comissões

**Como** afiliado,
**quero** ver o histórico detalhado das minhas comissões com filtro por status,
**para que** eu acompanhe cada venda e seu status de pagamento.

**Critérios de aceitação:**

```gherkin
Dado que acesso o histórico de comissões
Quando filtra por status "available"
Então vejo apenas comissões prontas para saque
E cada linha exibe: produto, valor da venda, valor da comissão, taxa aplicada, data da venda, data de liberação

Dado que clico em uma comissão
Quando o detalhe abre
Então vejo a trilha de auditoria completa (de pending até o status atual)
```

---

## Épico 4 — Rede de Coafiliação

### US-AF-08 — Recrutar novos afiliados

**Como** afiliado elegível (mínimo 1 venda nos últimos 30 dias),
**quero** compartilhar meu link de recrutamento,
**para que** afiliados que eu indicar me gerem comissão de rede de 5%.

**Critérios de aceitação:**

```gherkin
Dado que tenho pelo menos 1 venda nos últimos 30 dias
Quando acesso a seção de rede
Então vejo meu link /join/{meu_code} disponível para compartilhar
E vejo badge "Elegível para comissão de rede"

Dado que não tenho nenhuma venda nos últimos 30 dias
Quando acesso a seção de rede
Então vejo aviso de elegibilidade com quantos dias faltam ou quantas vendas preciso
E posso ver meus indicados mas sem comissão de rede ativa

Dado que um afiliado que indiquei realiza uma venda e comissão é liberada
Quando consulto meu extrato
Então aparece uma comissão de rede de 5% sobre a comissão do indicado
```

**Cenários de borda:**
- Campanha de recrutamento ativa → taxa pode ser diferente de 5% (resolveNetworkRules sobrescreve)
- Rede disabled pelo admin → seção de recrutamento oculta ou com aviso

---

### US-AF-09 — Monitorar indicados

**Como** afiliado recrutador,
**quero** ver a lista dos afiliados que indiquei com suas métricas,
**para que** eu saiba quem está ativo e quanto estou ganhando com a rede.

**Critérios de aceitação:**

```gherkin
Dado que tenho 3 indicados
Quando acesso "Minha Rede"
Então vejo lista com: código do indicado, data de entrada, contagem de vendas, earnings gerados, status ativo/inativo

Dado que quero exportar minha lista de indicados
Quando clico em "Exportar CSV"
Então faço download de arquivo CSV com os dados da listagem
```

---

## Épico 5 — Capacitação

### US-AF-10 — Assistir tutoriais

**Como** afiliado novo,
**quero** acessar os tutoriais organizados por categoria,
**para que** eu aprenda como começar, realizar minha primeira venda e escalar.

**Critérios de aceitação:**

```gherkin
Dado que acesso a área de tutoriais
Quando filtra por categoria "getting-started"
Então vejo tutoriais ordenados pelo campo `order` ASC

Dado que clico em um tutorial
Quando o player abre
Então o vídeo do YouTube é carregado via youtubeId extraído da URL
E um botão CTA com `ctaTo` leva para a seção indicada do app

Dado que um tutorial tem `required = true`
Quando visualizo meu progresso de onboarding
Então esse tutorial aparece como obrigatório no checklist
```

---

## Épico 6 — Alertas e Notificações

### US-AF-11 — Receber alertas proativos

**Como** afiliado,
**quero** ser notificado sobre eventos relevantes (saldo disponível, campanhas expirando, pico de vendas),
**para que** eu tome ação no momento certo.

**Critérios de aceitação:**

```gherkin
Dado que tenho R$ 100 ou mais disponíveis para saque
Quando acesso o dashboard
Então vejo alerta de severidade "success" com CTA para a área financeira

Dado que uma promoção expira em 3 dias ou menos
Quando visualizo alertas do escopo "campaigns"
Então vejo alerta de severidade "warning" com nome da promoção e dias restantes

Dado que minhas vendas tiveram crescimento >= 15% na segunda metade do período
Quando consulto alertas
Então vejo alerta "sales spike" de severidade "success"

Dado que minhas vendas caíram >= 15%
Quando consulto alertas
Então vejo alerta "sales drop" de severidade "warning"
```

**Cenários de borda:**
- Alertas com ID determinístico — o mesmo alerta não aparece duplicado se condição persistir entre recarregamentos
- Ordenação: danger → warning → success → info, depois data desc

---

## Resumo de cobertura

| US | Módulos cobertos | Complexidade |
|----|-----------------|--------------|
| US-AF-01 | auth, referral-tracking | Alta |
| US-AF-02 | auth | Média |
| US-AF-03 | products, promotions | Média |
| US-AF-04 | referral-tracking, products | Baixa |
| US-AF-05 | commissions, finance-affiliate | Alta |
| US-AF-06 | withdrawals-payout, commissions | Alta |
| US-AF-07 | commissions | Média |
| US-AF-08 | network, commissions | Alta |
| US-AF-09 | network | Baixa |
| US-AF-10 | tutorials | Baixa |
| US-AF-11 | smart-alerts | Média |
