# CLAUDE.md — Matrix Workspace

> Este arquivo é carregado automaticamente em cada sessão.
> Mantenha-o atualizado sempre que houver decisões arquiteturais relevantes.

---

## 📝 Regra de Atualização de Documentação

Após qualquer mudança técnica relevante, atualizar o arquivo correspondente:

| Situação | Arquivo a atualizar |
|----------|-------------------|
| Decisão arquitetural, novo módulo, mudança de stack | `docs/ARCHITECTURE.md` |
| Rota nova, schema de banco, contrato de API | `docs/BACKEND.md` (criar se não existir) |
| Progresso de módulo, status de tarefas, próximos passos | `STATUS.md` |
| Instrução de setup, deploy ou uso do projeto | `README.md` |

> Regra: se a mudança afeta como o projeto funciona ou é mantido, ela deve estar documentada. Não deixar para depois.

---

## 🏭 Protocolo da Linha de Montagem (Criação de Apps)

Sempre que o usuário informar "vamos construir um app" ou enviar um texto fundacional, o Claude DEVE seguir estritamente este pipeline:

### Como os Blueprints chegam
O usuário usa o app **blueprint-manager** (`apps/blueprint-manager`) para escrever Brain Dumps e gerar Blueprints Oficiais (com critérios de aceite CA## e seção "Caro Claude"). O conteúdo é copiado como texto e colado aqui no terminal.

### Pipeline obrigatório

1. **Reconhecimento & Fundação:**
   - Ao receber o **texto fundacional** (visão geral do projeto), crie o arquivo `apps/[nome-do-projeto]/docs/ARCHITECTURE.md` com base nele.
   - O `ARCHITECTURE.md` é a fonte da verdade do projeto — leia-o antes de qualquer módulo e atualize-o ao concluir cada módulo.
   - Registre o progresso no `ARCHITECTURE.md` (isso alimenta o gráfico de conclusão no blueprint-manager).

2. **Inversão de Planejamento (Ordem dos Módulos):**
   - Após criar o `ARCHITECTURE.md`, liste todos os módulos identificados e sugira a **ordem cronológica de construção**, justificando dependências.
   - O usuário então gera o Blueprint do primeiro módulo sugerido e entrega para execução.

3. **Consulta ao Almoxarifado (Reuso):**
   - Antes de escrever qualquer código do zero, acesse `packages/almoxarifado`.
   - Verifique módulos, componentes ou lógicas reaproveitáveis para agilizar a construção.

4. **Execução Módulo a Módulo:**
   - Implemente um Blueprint por vez (fracionado para manter qualidade).
   - Ao concluir: atualize `docs/ARCHITECTURE.md` e `.matrix/status.json` com o progresso.

---

## 🔬 Fase de Dissecação (pós-app concluído)

> ⚠️ Esta fase é **separada e posterior** ao pipeline de construção. Nunca ocorre durante o build.

**Gatilho:** o usuário declara explicitamente "vamos dissecar o [app]" — isso só acontece depois que o app passou pelo ciclo completo.

### Ciclo completo obrigatório antes de dissecar:
1. Lovable criou o protótipo navegável (interface + fluxos)
2. Claude/Codex refinaram regras de negócio, validações, exceções
3. Backend real está conectado (banco, auth, APIs, workers)
4. App está minimamente maduro em produção ou staging

### O que fazer ao dissecar:
1. Os arquivos do Lovable ficam em `dissection/[nome-do-app]/` — nunca modificar os originais
2. Extrair apenas módulos já refinados pelo ciclo backend → `packages/almoxarifado/`
3. Cada módulo extraído deve ter documentação mínima de uso no almoxarifado

### Por que essa ordem importa:
O almoxarifado só recebe peças **aprovadas pelo backend real**. Dissecar antes significa extrair código que vai mudar — o almoxarifado ficaria defasado na primeira integração.

---

## 📚 Arquivos Vivos de Projeto (obrigatórios por app)

Todo app em construção DEVE manter estes três arquivos atualizados — são a memória de sessão entre conversas:

| Arquivo | Localização | Conteúdo |
|---------|------------|----------|
| `ARCHITECTURE.md` | `apps/[app]/docs/` | Visão geral, decisões, stack, módulos e status de cada um |
| `EXECUTION_ORDER.md` | `apps/[app]/docs/` | Ordem de construção dos módulos, dependências, o que foi feito, o que vem a seguir |
| `STATUS.md` | `apps/[app]/` | Pendências abertas, onde parou, próximos passos concretos |

> Estes arquivos substituem a conversa como fonte de verdade. Se a sessão reiniciar, leia os três antes de qualquer ação.

### Regra canonica do Dashboard do Blueprint Manager

O Dashboard de Progresso de Fabricacao le o arquivo `apps/[app]/.matrix/status.json`.

Ao criar um app a partir de um projeto do Blueprint Manager, a pasta tecnica dentro de `apps/` deve ser o nome normalizado do projeto:

```text
005 - Maquina_Meta -> apps/maquina-meta
```

Normalizacao obrigatoria:
- remover prefixo numerico inicial, como `005 -`;
- remover acentos;
- trocar underscores e espacos por hifen;
- usar lowercase;
- remover caracteres que nao sejam letras, numeros ou hifen.

Durante a execucao, atualizar `apps/[app]/.matrix/status.json` a cada etapa relevante com:

```json
{
  "project": "Nome do App",
  "progress": 10,
  "currentTask": "O que esta acontecendo agora",
  "completedTasks": ["Tarefas concluidas"],
  "pendingTasks": ["Proximas tarefas"],
  "logs": ["> [Claude] registro recente"]
}
```

Sem esse caminho e nome normalizados, o Dashboard fica em `0%` ou mostra `Aguardando Blueprint...` mesmo que o app exista.

### Regra de pausa (ao parar por qualquer motivo)

Antes de encerrar trabalho em qualquer módulo, o Claude DEVE:
1. Registrar em `STATUS.md`: **exatamente onde parou**, o que foi implementado, o que falta
2. Atualizar `EXECUTION_ORDER.md`: marcar o módulo atual como `[em andamento]` ou `[concluído]`
3. Registrar em `ARCHITECTURE.md`: qualquer decisão técnica tomada na sessão
4. Atualizar `.matrix/status.json` para refletir progresso, proxima tarefa e logs recentes no Dashboard
5. Nunca marcar item como `[concluido]` sem evidencia (arquivo criado, rota testada, migracao rodada)

### Regra de retomada (ao iniciar sessão em projeto existente)

Quando o usuário disser "vamos continuar o [app]" ou entregar um Blueprint novo:
1. Leia `apps/[app]/docs/ARCHITECTURE.md`
2. Leia `apps/[app]/docs/EXECUTION_ORDER.md`
3. Leia `apps/[app]/STATUS.md`
4. Leia `apps/[app]/.matrix/status.json`
5. Declare o que vai fazer antes de comecar - sem surpresas

---

## Modo de operação obrigatório — Skill Master (HIERARQUIA_DE_SKILLS_v1)

**Sempre que o usuário pedir execução de qualquer tarefa**, identificar a natureza e declarar as skills antes de responder.

### Fluxo obrigatório
```
INPUT → DETECTOR DE FASE → SELETOR DE SKILLS → EXECUÇÃO GUIADA → OUTPUT PADRONIZADO
```

### Identificação obrigatória
- **técnica** (backend, banco, integração, deploy, bug) → priorizar `senior-backend`, `api-integration-specialist`, `database-schema-designer`
- **exploratória** (ideias, estratégia, marketing) → `brainstorming`, `micro-saas-launcher`, `marketing-*`
- Em dúvida → assumir técnica, executar, refinar depois

### Estrutura obrigatória de resposta
```
🎯 Skill Primária: [nome]
🧩 Skill Secundária (opcional): [nome]
📍 Fase: [fase]

🚀 Execução:
[solução direta]

💡 Refinamento (opcional):
[melhorias]
```

> `brainstorming` NUNCA pode ser skill primária em tarefas técnicas.

### Regra de precedência final
> A skill primária e a fase devem ser declaradas **antes** de qualquer leitura de arquivo, análise de contexto ou pergunta ao usuário.
> O pedido do usuário sozinho é suficiente para definir skill e fase.
> É proibido abrir arquivos ou analisar código antes dessa declaração.

Referência completa: `.claude/projects/.../memory/skill_master_template.md`
Lista de skills: `.claude/projects/.../memory/skills_installed.md`

---

## O que é este workspace

**Matrix** é o workspace principal — uma fábrica de SaaS com automações de IA.
O atendimento via WhatsApp roda na VPS via **Evolution API + n8n**. O código aqui é focado nos apps SaaS.

> ⚠️ `src/` (matrix-wpp/Baileys) foram **removidos** — não existem mais.

---

## VPS (laboratório atual — Speedfy)

A infraestrutura roda em VPS gerenciada pelo painel **Speedfy.host**:

| Serviço | Versão | Porta |
|---------|--------|-------|
| OpenResty (Nginx) | 1.27.1 | 80 / 443 |
| PostgreSQL | 17.0 | 5432 |
| Evolution API | v2.3.6 | 8080 |
| Redis | 7.4.1 | 6379 |
| n8n | 2.7.4 | 5678 |

**Migração futura:** quando houver o primeiro produto em produção real, migrar para VPS Hostinger dedicada. O ambiente é idêntico — só trocar IP/SSH nos secrets do GitHub Actions.

---

## 🚀 Estratégia de Deploy — Zero Downtime

### Estágio atual: Graceful Shutdown (ativo)
O `docker-compose.yml` tem `stop_grace_period: 30s` — ao fazer deploy, o Docker espera 30 segundos para requests em andamento terminarem antes de matar o container. Janela de indisponibilidade: ~15-20s durante o build.

**Comando de deploy:**
```bash
cd /root/Matrix && git pull && cd infra/docker/shaikron && docker compose build shaikron-api --no-cache && docker compose up -d shaikron-api
```

### Próximo estágio: Blue-Green Deploy (ativar com ~1.000 usuários ativos)
Template pronto em `infra/docker/shaikron/docker-compose.blue-green.yml`.

Estratégia: duas versões rodam simultaneamente (blue=atual, green=nova). O Nginx troca o tráfego instantaneamente após o green passar no healthcheck. Zero downtime real.

> ⚠️ **LEMBRETE:** Migrar para Blue-Green quando o Evolia atingir ~1.000 usuários ativos simultâneos.

---

## WhatsApp / Automações (n8n)

- **WhatsApp:** Evolution API v2.3.6 — não Baileys (abandonado)
- **Orquestração de fluxos:** n8n self-hosted na VPS
- **Sem código de bot local** — tudo vive dentro do n8n

### Credenciais configuradas no n8n

| Credencial | Tipo |
|------------|------|
| Google Drive | OAuth2 |
| Google Sheets | OAuth2 |
| Google Calendar | OAuth2 |
| Google Service Account | Service Account |
| Gmail | OAuth2 |
| Facebook Graph | Graph API |
| WhatsApp / Evolution API | Evolution API |
| Redis | Redis |
| OpenAI | API Key |
| PostgreSQL | Postgres |
| Supabase | Supabase API |

---

## Stack — Apps SaaS (apps/)

```
Monorepo:   pnpm workspaces + Turborepo
Frontend:   Next.js App Router + TypeScript + Tailwind CSS + shadcn/ui  →  apps/web/
Backend:    Fastify + TypeScript                                         →  apps/api/
Auth:       Supabase Auth                           (@boilerplate/auth)
DB:         PostgreSQL via Supabase + Prisma        (@boilerplate/database)
Pagamentos: Stripe + AppMax (assinaturas, checkout + webhooks)          (@boilerplate/billing)
UI:         shadcn/ui padronizado                   (@boilerplate/ui)
```

> **Rebranding Evolia by Shaikron:** O produto SaaS chama **Evolia** (identidade visual do frontend). A infraestrutura (Docker, schema do banco, pastas, webhooks) permanece com o nome técnico **Shaikron** — que será o nome da empresa/holding. Nunca renomear infraestrutura para Evolia.

---

## Estrutura do monorepo

```
Matrix/
├── apps/               # Produtos SaaS deployáveis
│   ├── web/            # Next.js App Router (frontend)
│   ├── api/            # Fastify (backend)
│   └── gmaps-scraper/  # Scraper Google Maps
│
├── packages/           # Módulos reutilizáveis (@boilerplate/*)
│   ├── auth/           # @boilerplate/auth (Supabase)
│   ├── billing/        # @boilerplate/billing (Stripe + AppMax)
│   ├── ui/             # @boilerplate/ui (shadcn)
│   ├── database/       # @boilerplate/database (Prisma + Supabase)
│   └── almoxarifado/   # Módulos extraídos via dissecação de apps externos
│
├── dissection/         # Apps externos clonados para análise e extração de módulos
│   └── shaikron/       # App Shaikron (Lovable) — fonte de dissecação
│       ├── frontend/   # Frontend gerado pelo Lovable
│       └── backend-hub/# Backend gerado pelo Lovable
│   # Padrão: dissection/<nome-do-app>/ para futuros apps
│
├── plugins/            # Plugins Paperclip (músculos dos agentes)
│   ├── 00_REGRA_DOS_PLUGINS.md
│   ├── PLUGIN_GUIDE.md
│   └── meta-ads/       # Plugin Meta Ads (instalado)
│
├── paperclip-org/      # Cérebro da holding — prompts e hierarquia de agentes
│   ├── 00_REGRA_DOS_AGENTES.md
│   ├── 01_C_Level/
│   ├── 02_Managers/
│   └── 03_Specialists/
│
├── infra/
│   ├── nginx/          # config OpenResty/Nginx
│   ├── pm2/            # ecosystem.config.js
│   └── scripts/
│       ├── setup-vps.sh
│       └── deploy.sh
│
├── .github/workflows/  # CI/CD GitHub Actions
├── CLAUDE.md
├── turbo.json
└── package.json        # pnpm workspaces root
```

---

## Variáveis de ambiente (.env)

Redis local na VPS:
```
MATRIX_REDIS_URL=redis://127.0.0.1:6379
```

> ⚠️ Qualquer referência a `${{...}}` é resquício do Railway — não usar mais.

---

## Convenções de banco de dados (Supabase / PostgreSQL)

**Schemas obrigatórios — sempre organizar tabelas por schema:**

Toda proposta de criação de tabela deve incluir o schema. Nunca criar tabelas direto no `public` sem justificativa.

**Regra canônica:** cada produto/app recebe seu próprio schema com nome curto e descritivo.
Nunca usar `app` como schema genérico — ele não escala para múltiplos produtos.

| Schema | Finalidade |
|--------|-----------|
| `public` | Apenas tabelas genéricas sem dono claro (evitar) |
| `auth` | Gerenciado pelo Supabase Auth — não mexer |
| `billing` | Tabelas de pagamento/Stripe compartilhadas (ex: `billing.invoices`) |
| `whatsapp` | Tabelas relacionadas a automações WhatsApp/n8n |
| `analytics` | Eventos, logs de uso, métricas |
| `expenses` | App de controle de gastos pessoais |
| `calo` | Sistema de venda de calopsitas B2B |
| *(novo app)* | Criar schema com nome curto do produto |

> ⚠️ Ao propor qualquer `CREATE TABLE`, sempre incluir o schema — ex: `CREATE TABLE calo.chicks (...)`.
> Criar o schema antes se ainda não existir: `CREATE SCHEMA IF NOT EXISTS calo;`

---

## Convenções de código

**Apps (TypeScript):**
- Strict mode ligado
- Zod para validação de qualquer input externo
- Types compartilhados em `@boilerplate/shared-types`
- Fastify para backend — não Next.js API routes
- Pino para logs — nunca `console.log` em produção

---

## Contexto de desenvolvimento

- Prototipagem visual via **Lovable** → contratos de API → código aqui
- Lovable gera o design de referência; o código de produção vive neste repo
- n8n para automações e fluxos de WhatsApp

---

## O que NÃO fazer

- Não referenciar Baileys, matrix-wpp — foram abandonados
- Não usar Railway — migrado para fora
- Não adicionar Docker ainda — PM2 é o padrão atual (entra com 3+ apps em produção)
- Não criar Next.js API routes como substituto do Fastify
- Não hardcodar configs — usar `.env`
- Não criar abstrações prematuras para uso único
- Não usar `console.log` — usar Pino

---

# Reversa

> Framework de Engenharia Reversa instalado neste projeto.

## Como usar

Digite `/reversa` para ativar o Reversa e iniciar ou retomar a análise do projeto.

## Comportamento ao ativar

Quando o usuário digitar `/reversa` ou a palavra `reversa` sozinha em uma mensagem:

1. Ative o skill `reversa` disponível em `.claude/skills/reversa/SKILL.md`
2. Se não encontrar em `.claude/skills/`, tente `.agents/skills/reversa/SKILL.md`
3. Leia o SKILL.md na íntegra e siga exatamente as instruções do Reversa

## Regra não-negociável

Nunca apague, modifique ou sobrescreva arquivos pré-existentes do projeto legado.
O Reversa escreve **apenas** em `.reversa/` e `_reversa_sdd/`.
