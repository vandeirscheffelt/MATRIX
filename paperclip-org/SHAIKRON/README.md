# 🏢 Shaikron — Laboratório de Engenharia Reversa & Extração

Bem-vindo à **Shaikron**, uma unidade estratégica da **Scheffelt Matrix Holding**.
Este diretório não é apenas um repositório de código; é uma **Cápsula de Inteligência** dedicada à dissecação de aplicações SaaS e à mineração de ativos tecnológicos.

> *"Ninguém toca na Prateleira sem o aval do CTO e a revisão do Code Reviewer."*

---

## 🎯 Missão: "Extrair o Osso da Carne"

A Shaikron existe para **uma única finalidade**: dissecar apps criados no Lovable e extrair o que for reutilizável para o almoxarifado da Holding.

O objetivo final é que, ao longo do tempo, a Matrix acumule tantos módulos prontos que novos apps possam ser construídos **sem precisar do Lovable** — com velocidade crescente e qualidade cada vez maior.

| Conceito | Definição |
|----------|-----------|
| **A Carne** | Lógica de negócio específica do app dissecado — fica no app, não vai para o almoxarifado |
| **O Osso** | Infraestrutura agnóstica, integrações, padrões de UI e utilitários — vai para o almoxarifado |
| **O Almoxarifado** | `Matrix/packages/almoxarifado/` — a prateleira de ativos reutilizáveis de toda a Holding |

---

## 🗂️ Territórios de Trabalho

Cada app dissecado vive em sua própria pasta dentro de `Matrix/dissection/`:

```
Matrix/
├── dissection/
│   └── shaikron/               ← app atual em dissecação
│       ├── frontend/           ← território do Inspetor Frontend
│       └── backend-hub/        ← território do Inspetor de Módulos e especialistas
│
└── packages/
    └── almoxarifado/           ← destino de tudo que foi aprovado
        ├── ui-components/      ← componentes visuais genéricos
        ├── ui-patterns/        ← padrões de layout semi-genéricos
        ├── agenda-core/        ← lógica de agendamento
        ├── whatsapp-core/      ← integração Evolution API
        ├── billing-saas/       ← padrão Stripe
        └── [outros módulos]/
```

**Regra absoluta**: nenhum agente modifica arquivos dentro de `dissection/`. Essa pasta é **somente leitura** — é a carcaça do Lovable, a fonte de verdade para extração.

---

## 🔄 Fluxo de Operação (do início ao fim)

```
Usuário aciona o CEO
        │
        ▼
CEO planeja a missão e aciona o CTO
        │
        ▼
CTO valida a arquitetura e define diretrizes
        │
        ▼
Tech Lead recebe as diretrizes e orquestra os inspetores em paralelo:
        │
        ├── Inspetor Frontend  →  lê dissection/shaikron/frontend/
        │       │                 classifica componentes e design tokens
        │       └── relatório de extração → Tech Lead
        │
        └── Inspetor de Módulos →  lê dissection/shaikron/backend-hub/
                │                  classifica lógica e delega ao especialista correto
                │
                ├── Senior Backend      →  extrai rotas e contratos de API
                ├── Database Designer   →  extrai schemas e models
                ├── Motor de Agenda     →  extrai lógica de slots
                ├── IA WhatsApp         →  extrai fluxos e webhooks
                └── Billing SaaS        →  extrai padrão Stripe
                        │
                        ▼
                Almoxarife verifica se já existe algo igual no almoxarifado
                        │
                        ▼
                Code Reviewer — portão final (nada entra sem APROVADO)
                        │
                        ▼
                packages/almoxarifado/  ←  módulo depositado e versionado
```

---

## 🏛️ Estrutura de Comando & Potência de Fogo (Série 4.6)

A Shaikron opera com alocação estratégica de modelos para garantir **Qualidade de Elite** com **Economia Inteligente**:

### Nível 01: Estratégia (C-Level) — Claude Opus 4.6

| Agente | Papel |
|--------|-------|
| **CEO** | Comandante. Recebe a missão do usuário, planeja e distribui para o CTO |
| **CTO** | Guardião da arquitetura. Valida o que entra no almoxarifado e dá aval final |

### Nível 02: Gestão (Managers) — Claude Sonnet 4.6

| Agente | Papel |
|--------|-------|
| **Tech Lead** | Maestro. Orquestra os inspetores e especialistas, mantém o SCHAIKRON_STATUS.md atualizado |

### Nível 03: Especialistas — Suporte Operacional (Claude Haiku 4.5)

| Agente | Território | O que faz |
|--------|-----------|-----------|
| **Inspetor Frontend** | `frontend/` | Lê e classifica componentes, layouts e design tokens |
| **Inspetor de Módulos** | `backend-hub/` | Lê, classifica lógica backend e delega ao especialista correto |
| **Almoxarife** | `almoxarifado/` | Verifica se o módulo já existe antes de extrair |
| **Database Designer** | `backend-hub/` | Extrai schemas, models e migrations |

### Nível 03: Especialistas — Pesos Pesados (Claude Sonnet 4.6)

| Agente | Território | O que faz |
|--------|-----------|-----------|
| **Senior Backend** | `backend-hub/` | Extrai rotas, contratos de API e utilitários de servidor |
| **Motor de Agenda** | `backend-hub/` | Extrai lógica de disponibilidade e slots |
| **IA WhatsApp** | `backend-hub/` | Extrai fluxos de conversa e integração Evolution API |
| **Billing SaaS** | `backend-hub/` | Extrai padrão Stripe, assinaturas e webhooks |

### Nível 03: Revisão Crítica — Claude Opus 4.6

| Agente | Papel |
|--------|-------|
| **Code Reviewer** | Portão final. Nada entra no almoxarifado sem seu APROVADO |

---

## ⚖️ Leis Fundamentais da Unidade

1. **Standby por padrão** — nenhum agente age sem ser acionado pelo CEO ou Tech Lead
2. **Leitura antes de tudo** — qualquer extração começa lendo `dissection/` (nunca modificar)
3. **Almoxarife primeiro** — antes de extrair, verificar se já existe algo igual
4. **Osso só entra com aval** — Code Reviewer aprova, CTO valida arquitetura
5. **Sem sobreposição** — Inspetor Frontend cuida do `frontend/`, Inspetor de Módulos cuida do `backend-hub/`
6. **Um território, um dono** — cada especialista tem seu domínio; nenhum invade o do outro
7. **Autoconsciência técnica** — agentes Claude usam `C:\tools\claude.cmd` para compatibilidade Windows

---

## 📋 O que vai para o Almoxarifado

| Vai ✅ | Não vai ❌ |
|--------|----------|
| Componentes de UI sem lógica de negócio | Telas específicas do app |
| Design tokens (cores, tipografia, espaçamento) | Regras de preço ou planos específicos |
| Integração genérica com Evolution API | Fluxo de conversa com tom de voz do Shaikron |
| Padrão de assinatura Stripe (checkout, webhooks) | Valores de planos do Shaikron |
| Schema com UUID + timestamps + tenant isolation | Tabelas com regras de negócio específicas |
| Lógica de cálculo de slots (agnóstica) | Configurações de grade do Shaikron |
| Helpers genéricos (CPF, moeda, datas) | Qualquer coisa que só faz sentido no Shaikron |

---

## 🛠️ Stack Tecnológica Canônica

- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: Fastify + TypeScript + Zod + Pino
- **ORM**: Prisma (schema `atendente_ia` para o Shaikron)
- **Banco**: PostgreSQL via Supabase
- **Pagamentos**: Stripe (assinaturas + webhooks)
- **Mensageria**: Evolution API + n8n
- **Arquitetura de destino**: Monorepo Matrix com módulos em `packages/almoxarifado/`
