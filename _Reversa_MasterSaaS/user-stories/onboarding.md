# User Stories — Onboarding
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Persona

**Novo Afiliado** — usuário que acabou de se cadastrar no MasterSaaS e ainda não realizou sua primeira venda. O onboarding é o caminho crítico que transforma um cadastro em um afiliado ativo.

---

## Épico 1 — Primeiro Acesso

### US-OB-01 — Banner de boas-vindas pós-signup com referral

**Como** novo afiliado que se cadastrou via link de indicação,
**quero** ver uma mensagem de boas-vindas personalizada ao entrar pela primeira vez,
**para que** eu saiba que fui indicado por alguém e que minha conta está corretamente vinculada.

**Critérios de aceitação:**

```gherkin
Dado que me cadastrei via /join/JOAO1234
Quando acesso o painel pela primeira vez após o signup
Então vejo banner: "Bem-vindo! Você foi convidado por [display_name do indicador]."
E o banner é exibido apenas uma vez (markWelcomePending limpo após exibição)

Dado que me cadastrei sem link de indicação
Quando acesso o painel pela primeira vez
Então não vejo banner de indicação
E vejo mensagem genérica de boas-vindas com CTA para o primeiro passo
```

**Cenários de borda:**
- Indicador sem display_name → exibir affiliate_code como fallback ("Você foi convidado por JOAO1234")
- Banner não aparece se localStorage foi limpo antes do primeiro acesso (sessão em outro dispositivo)

---

### US-OB-02 — Checklist de primeiros passos

**Como** novo afiliado,
**quero** ver um checklist guiado com os passos iniciais obrigatórios,
**para que** eu saiba exatamente o que preciso fazer para estar pronto para vender.

**Critérios de aceitação:**

```gherkin
Dado que acabei de me cadastrar
Quando acesso o dashboard
Então vejo checklist com os passos: [completar perfil, assistir tutoriais obrigatórios, copiar primeiro link de afiliado]
E cada passo exibe status: pendente ou concluído

Dado que completo todos os passos do checklist
Quando o último passo é marcado
Então vejo mensagem de parabéns e o checklist é ocultado ou recolhido
E o dashboard principal é exibido em modo completo

Dado que o checklist tem tutoriais com required = true
Quando visualizo os passos
Então apenas tutoriais marcados como required aparecem no checklist
```

**Cenários de borda:**
- Usuário fecha o app antes de concluir o checklist → ao retornar, estado do checklist é preservado
- Nenhum tutorial com required = true cadastrado → passo de tutoriais não aparece no checklist

---

## Épico 2 — Configuração de Perfil

### US-OB-03 — Completar perfil

**Como** novo afiliado,
**quero** definir meu nome de exibição,
**para que** meu perfil seja identificável e apareça corretamente nas notificações e na rede.

**Critérios de aceitação:**

```gherkin
Dado que meu display_name está vazio (cadastro via Google sem nome)
Quando acesso configurações de perfil
Então vejo campo para inserir display_name com max 100 chars
E ao salvar, o perfil é atualizado via PATCH /profiles/me

Dado que tento salvar display_name vazio
Quando confirmo
Então vejo validação: "Nome de exibição não pode estar vazio"

Dado que meu affiliate_code foi gerado
Quando visualizo meu perfil
Então vejo o código imutável exibido (não editável)
E um botão para copiar o código diretamente
```

**Cenários de borda:**
- Cadastro via email+senha com displayName fornecido → display_name já preenchido, passo marcado como concluído automaticamente
- affiliate_code nunca exibido como campo editável — apenas leitura

---

## Épico 3 — Primeiro Link e Primeira Venda

### US-OB-04 — Copiar primeiro link de afiliado

**Como** novo afiliado que concluiu o perfil,
**quero** copiar meu link de afiliado para o produto principal,
**para que** eu comece a divulgar imediatamente.

**Critérios de aceitação:**

```gherkin
Dado que acesso a tela de produtos durante o onboarding
Quando clico em "Copiar link" de um produto
Então o link no formato {baseUrl}/r/{meu_code}/{productSlug} é copiado para a área de transferência
E o passo "copiar primeiro link" é marcado como concluído no checklist

Dado que não há produtos ativos no catálogo
Quando acesso a tela de produtos
Então vejo estado vazio com mensagem "Nenhum produto disponível no momento"
E o passo de link permanece pendente
```

---

### US-OB-05 — Entender comissão antes da primeira venda

**Como** novo afiliado,
**quero** ver claramente quanto vou ganhar por venda em cada produto,
**para que** eu priorize o produto certo para divulgar.

**Critérios de aceitação:**

```gherkin
Dado que visualizo o catálogo de produtos
Quando há promoção ativa para um produto
Então vejo a taxa efetiva da promoção destacada (ex: "40% durante julho")
E se Performance Boost estiver ativo, vejo "até 50% com 5+ vendas"

Dado que não há promoção ativa
Quando visualizo o produto
Então vejo apenas a taxa base e a duração da comissão (Lifetime, 12 months, etc.)
```

---

## Épico 4 — Capacitação Guiada

### US-OB-06 — Trilha de tutoriais obrigatórios

**Como** novo afiliado,
**quero** assistir os tutoriais marcados como obrigatórios em sequência,
**para que** eu aprenda o sistema antes de começar a vender.

**Critérios de aceitação:**

```gherkin
Dado que há 3 tutoriais com required = true nas categorias getting-started e first-sale
Quando acesso a trilha de onboarding
Então vejo os 3 tutoriais ordenados pelo campo `order` ASC
E cada tutorial exibe: thumbnail do YouTube, título, descrição e botão CTA

Dado que clico no CTA de um tutorial
Quando a navegação ocorre
Então sou direcionado para a rota interna definida em `ctaTo`
E o tutorial é marcado como assistido no progresso de onboarding

Dado que assisto todos os tutoriais obrigatórios
Quando o último é concluído
Então o passo de tutoriais no checklist é marcado como concluído
```

**Cenários de borda:**
- Tutorial com youtubeUrl inválida (youtubeId = null) → exibir placeholder em vez do player, sem quebrar a tela
- Reordenação de tutoriais pelo admin → nova ordem refletida imediatamente no onboarding

---

## Épico 5 — Ativação da Rede

### US-OB-07 — Entender elegibilidade de rede durante onboarding

**Como** novo afiliado sem vendas,
**quero** saber o que preciso fazer para poder recrutar outros afiliados,
**para que** eu planeje minha estratégia de rede desde o início.

**Critérios de aceitação:**

```gherkin
Dado que ainda não realizei nenhuma venda
Quando acesso a seção de rede
Então vejo aviso: "Faça pelo menos 1 venda nos últimos 30 dias para desbloquear comissões de rede"
E meu link de recrutamento já é exibido (posso compartilhar, mas não recebo comissão de rede ainda)

Dado que a regra de elegibilidade mudou (ex: minSalesRequired = 3)
Quando acesso a seção
Então o aviso reflete a regra atual resolvida (resolveNetworkRules), não um valor fixo
```

**Cenários de borda:**
- Rede desabilitada pelo admin → seção de rede não aparece no menu de onboarding
- Campanha de recrutamento ativa com eligibilityDaysOverride menor → aviso usa o valor da campanha

---

## Fluxo completo de onboarding (sequência)

```
Signup (via link ou direto)
    ↓
Banner de boas-vindas (se referral)
    ↓
Checklist aparece no dashboard:
  [ ] 1. Completar perfil (display_name)
  [ ] 2. Assistir tutoriais obrigatórios
  [ ] 3. Copiar primeiro link de afiliado
    ↓
Ao concluir todos os passos:
  → Checklist recolhido
  → Dashboard em modo completo
  → Usuário elegível para iniciar vendas
```

---

## Resumo de cobertura

| US | Módulos cobertos | Complexidade |
|----|-----------------|--------------|
| US-OB-01 | auth, referral-tracking | Média |
| US-OB-02 | tutorials, auth | Média |
| US-OB-03 | auth (profiles) | Baixa |
| US-OB-04 | referral-tracking, products | Baixa |
| US-OB-05 | products, promotions | Baixa |
| US-OB-06 | tutorials | Média |
| US-OB-07 | network | Baixa |
