# Guia de Skills — Como usar no Claude Code / Antigravity

## Como acionar uma skill

No chat do Claude Code (Antigravity), basta escrever:

```
/nome-da-skill
```

Ou acioná-la de forma descritiva dentro do prompt:
```
Use a skill senior-architect para desenhar a arquitetura deste app
```

Você também pode combinar skills em uma mesma sessão. Exemplo:
```
Use senior-architect + database-schema-designer para modelar o banco do app de agendamentos
```

---

## Fases de desenvolvimento e qual skill usar

### FASE 1 — Ideia e Planejamento

| Skill | Comando | Quando usar |
|-------|---------|-------------|
| **brainstorming** | `/brainstorming` | Antes de qualquer coisa — validar a ideia, explorar features, pensar em diferenciais |
| **micro-saas-launcher** | `/micro-saas-launcher` | Quando a ideia for um produto SaaS — ajuda a definir MVP, público, proposta de valor |
| **pricing-strategy** | `/pricing-strategy` | Para definir modelo de cobrança (freemium, plano mensal, por uso, etc.) |
| **senior-architect** | `/senior-architect` | Para desenhar a arquitetura geral antes de escrever código |

**Exemplo de uso:**
> "Use brainstorming + micro-saas-launcher para estruturar minha ideia de app de agendamentos para clínicas"

---

### FASE 2 — Modelagem e Banco de Dados

| Skill | Comando | Quando usar |
|-------|---------|-------------|
| **database-schema-designer** | `/database-schema-designer` | Modelar as tabelas, relações, chaves, tipos de dados |
| **supabase-postgres-best-practices** | `/supabase-postgres-best-practices` | Aplicar boas práticas ao schema no Supabase (RLS, índices, particionamento) |
| **nextjs-supabase-auth** | `/nextjs-supabase-auth` | Configurar autenticação com Supabase Auth |

**Exemplo de uso:**
> "Use database-schema-designer para modelar o banco, depois aplique supabase-postgres-best-practices para revisar"

---

### FASE 3 — Desenvolvimento do Backend

| Skill | Comando | Quando usar |
|-------|---------|-------------|
| **senior-fullstack** | `/senior-fullstack` | Visão geral do projeto full stack — boas práticas, estrutura de pastas, padrões |
| **senior-backend** | `/senior-backend` | Criar rotas, serviços, middlewares, lógica de negócio (Node.js/Fastify) |
| **api-integration-specialist** | `/api-integration-specialist` | Integrar com APIs externas (WhatsApp, gateways, serviços terceiros) |
| **stripe-integration** | `/stripe-integration` | Implementar pagamentos com Stripe (checkout, webhooks, assinaturas) |

**Exemplo de uso:**
> "Use senior-backend para criar a rota POST /appointments com validação Zod e integração Supabase"

---

### FASE 4 — Desenvolvimento do Frontend

| Skill | Comando | Quando usar |
|-------|---------|-------------|
| **senior-frontend** | `/senior-frontend` | Criar componentes, páginas, hooks — quando ajustar código gerado pelo Lovable |
| **react-best-practices** | `/react-best-practices` | Otimizar performance do React (memo, re-renders, bundle, lazy loading) |

**Exemplo de uso:**
> "Use react-best-practices para revisar este componente de lista que está com re-renders excessivos"

---

### FASE 5 — Segurança e Qualidade

| Skill | Comando | Quando usar |
|-------|---------|-------------|
| **senior-security** | `/senior-security` | Auditar o código antes de ir para produção — injeção, exposição de dados, RLS |
| **code-reviewer** | `/code-reviewer` | Review completo de TS/JS — antipadrões, padrões de código, qualidade geral |
| **senior-qa** | `/senior-qa` | Criar estratégia de testes — unitários, integração, e2e |
| **webapp-testing** | `/webapp-testing` | Escrever testes automatizados com Playwright para o app rodando |
| **systematic-debugging** | `/systematic-debugging` | Quando um bug difícil aparece — metodologia para rastrear a causa raiz |

**Exemplo de uso:**
> "Use senior-security + code-reviewer para auditar o módulo de autenticação antes do deploy"

---

### FASE 6 — Deploy e Infraestrutura

| Skill | Comando | Quando usar |
|-------|---------|-------------|
| **docker-expert** | `/docker-expert` | Criar Dockerfile e docker-compose otimizados para o app |
| **senior-devops** | `/senior-devops` | Configurar CI/CD, pipelines, estratégias de deploy |
| **devops-iac-engineer** | `/devops-iac-engineer` | Infraestrutura como código — Nginx, configurações de VPS, Kubernetes se necessário |
| **github-workflow-automation** | `/github-workflow-automation` | Criar GitHub Actions para CI/CD automático |

**Exemplo de uso:**
> "Use docker-expert + senior-devops para criar o docker-compose do app com Nginx e SSL"

---

### FASE 7 — Manutenção e Evolução

| Skill | Comando | Quando usar |
|-------|---------|-------------|
| **git-commit-helper** | `/git-commit-helper` | Gerar mensagem de commit automática baseada no diff |
| **workflow-automation** | `/workflow-automation` | Automatizar tarefas repetitivas do projeto |
| **mcp-builder** | `/mcp-builder` | Criar MCPs customizados para estender o Antigravity |

---

## Fluxo completo de um app novo

```
1. /brainstorming          → valida a ideia
2. /micro-saas-launcher    → estrutura o produto
3. /pricing-strategy       → define monetização
4. /senior-architect       → desenha a arquitetura
5. /database-schema-designer → modela o banco
6. /supabase-postgres-best-practices → revisa o schema
7. /senior-backend         → constrói o backend
8. /nextjs-supabase-auth   → configura auth
9. /stripe-integration     → adiciona pagamentos (se necessário)
10. /senior-security       → audita antes do deploy
11. /code-reviewer         → review final do código
12. /docker-expert         → containeriza o app
13. /senior-devops         → configura CI/CD
14. /github-workflow-automation → automatiza o pipeline
```

---

## Dicas

- **Combine skills** quando a tarefa envolver múltiplas áreas: `"Use senior-backend + senior-security para criar o endpoint de login"`
- **Skills são contexto, não comandos mágicos** — elas carregam conhecimento especializado para a sessão. Quanto mais específico seu pedido, melhor o resultado
- **Não precisa acionar toda sessão** — o Claude já carrega o CLAUDE.md automaticamente. As skills são para tarefas específicas que precisam de profundidade extra
- **systematic-debugging** é para bugs difíceis — não use para erros simples de sintaxe
