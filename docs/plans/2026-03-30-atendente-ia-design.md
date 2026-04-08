# SCHEFFELT AI — Atendente IA: Design do Produto

**Data:** 2026-03-30
**Status:** Validado
**Schema:** `atendente_ia`

---

## Visão Geral

SaaS de atendente IA via WhatsApp focado em **agendamento**, vendido como mensalidade fixa (R$ 97/mês). O cliente configura tudo dentro do app — a IA do n8n consome essas configs em tempo real via Fastify.

**Público-alvo:** Negócios de atendimento com agenda — clínicas médicas, odontológicas, salões de beleza, prestadores de serviço — do analógico ao semi-digital.

**Fora do escopo do MVP:** módulo de vendas, integração com Google Calendar, múltiplos planos.

---

## Arquitetura

```
App (Lovable → apps/web)
    ↓ configura
Fastify (apps/api) ← fonte da verdade
    ↓ serve configs + gerencia instâncias
n8n (VPS) ← orquestra conversas
    ↓ usa
Evolution API (compartilhado) → WhatsApp
```

### Decisões arquiteturais

| Decisão | Escolha | Motivo |
|---------|---------|--------|
| Configs do bot | n8n busca via Fastify (cacheado Redis) | Lógica centralizada, sem credencial Supabase no n8n |
| Estado de conversa (pausar/reativar) | n8n escreve direto no Supabase | Menor latência em tempo real |
| Agendamentos | n8n chama Fastify POST | Validação de conflito centralizada |
| Agenda | Própria (sem Google Calendar) | Simplicidade para o MVP |
| Duração de atendimento | Por profissional | Flexibilidade sem complexidade |

---

## Perfis de Usuário

| Perfil | Acesso |
|--------|--------|
| Dono/Admin | Configura tudo, vê CRM completo |
| Profissional | Vê própria agenda |
| Gerente (2º número) | Comanda via WhatsApp (agendar, desmarcar, bloquear, resumos) |

---

## Trial e Monetização

- **Trial:** 24h automático no cadastro, sem cartão
- **Middleware:** checa `status = 'active'` OU `status = 'trial' AND trial_ends_at > now()`
- **Expirado:** API retorna 402, app mostra paywall
- **Plano:** mensalidade fixa — Stripe Checkout + portal de autoatendimento

---

## Banco de Dados — Schema `atendente_ia`

### Tenant, Usuários e Plano

```sql
atendente_ia.empresas
  id              UUID PK DEFAULT gen_random_uuid()
  nome            TEXT NOT NULL
  slug            TEXT UNIQUE NOT NULL
  criado_em       TIMESTAMPTZ DEFAULT now()

atendente_ia.usuarios
  id              UUID PK FK → auth.users
  empresa_id      UUID FK → atendente_ia.empresas
  role            TEXT NOT NULL  -- 'admin' | 'profissional'
  criado_em       TIMESTAMPTZ DEFAULT now()

atendente_ia.subscriptions
  id                      UUID PK DEFAULT gen_random_uuid()
  empresa_id              UUID FK → atendente_ia.empresas
  stripe_customer_id      TEXT
  stripe_subscription_id  TEXT
  status                  TEXT  -- 'trial' | 'active' | 'canceled' | 'past_due'
  trial_ends_at           TIMESTAMPTZ
  period_ends_at          TIMESTAMPTZ
  criado_em               TIMESTAMPTZ DEFAULT now()
```

### Profissionais e Agenda

```sql
atendente_ia.profissionais
  id                  UUID PK DEFAULT gen_random_uuid()
  empresa_id          UUID FK → atendente_ia.empresas
  usuario_id          UUID FK → atendente_ia.usuarios  -- nullable
  nome                TEXT NOT NULL
  duracao_padrao_min  INT NOT NULL DEFAULT 60
  ativo               BOOLEAN DEFAULT true
  criado_em           TIMESTAMPTZ DEFAULT now()

atendente_ia.grade_horarios
  id                UUID PK DEFAULT gen_random_uuid()
  profissional_id   UUID FK → atendente_ia.profissionais
  dia_semana        SMALLINT NOT NULL  -- 0=domingo ... 6=sábado
  hora_inicio       TIME NOT NULL
  hora_fim          TIME NOT NULL

atendente_ia.bloqueios
  id                UUID PK DEFAULT gen_random_uuid()
  profissional_id   UUID FK → atendente_ia.profissionais
  data_inicio       TIMESTAMPTZ NOT NULL
  data_fim          TIMESTAMPTZ NOT NULL
  motivo            TEXT  -- opcional, visível só para admin

atendente_ia.agendamentos
  id                UUID PK DEFAULT gen_random_uuid()
  empresa_id        UUID FK → atendente_ia.empresas
  profissional_id   UUID FK → atendente_ia.profissionais
  lead_id           UUID FK → atendente_ia.leads
  inicio            TIMESTAMPTZ NOT NULL
  fim               TIMESTAMPTZ NOT NULL
  status            TEXT  -- 'confirmado' | 'cancelado' | 'remarcado'
  criado_em         TIMESTAMPTZ DEFAULT now()
```

### WhatsApp e Bot

```sql
atendente_ia.instancias_whatsapp
  id                UUID PK DEFAULT gen_random_uuid()
  empresa_id        UUID FK → atendente_ia.empresas
  nome_instancia    TEXT NOT NULL UNIQUE
  token             TEXT NOT NULL
  status            TEXT  -- 'disconnected' | 'connecting' | 'connected'
  qr_code_base64    TEXT
  qr_expires_at     TIMESTAMPTZ
  criado_em         TIMESTAMPTZ DEFAULT now()

atendente_ia.config_bot
  id                UUID PK DEFAULT gen_random_uuid()
  empresa_id        UUID FK → atendente_ia.empresas UNIQUE
  prompt            TEXT NOT NULL
  tom               TEXT DEFAULT 'formal'  -- 'formal' | 'informal'
  palavra_pausa     TEXT DEFAULT '#humano'
  palavra_retorno   TEXT DEFAULT '#bot'
  tempo_retorno_min INT   -- null = usa palavra, número = usa tempo
  faq               JSONB DEFAULT '[]'
  bot_ativo         BOOLEAN DEFAULT true
  criado_em         TIMESTAMPTZ DEFAULT now()
  atualizado_em     TIMESTAMPTZ DEFAULT now()

atendente_ia.numeros_gerente
  id                UUID PK DEFAULT gen_random_uuid()
  empresa_id        UUID FK → atendente_ia.empresas
  telefone          TEXT NOT NULL
  resumo_ativo      BOOLEAN DEFAULT false
  resumo_intervalo  TEXT  -- 'diario' | 'semanal'
  resumo_horario    TIME
  criado_em         TIMESTAMPTZ DEFAULT now()

atendente_ia.leads
  id                UUID PK DEFAULT gen_random_uuid()
  empresa_id        UUID FK → atendente_ia.empresas
  telefone          TEXT NOT NULL
  nome_wpp          TEXT
  criado_em         TIMESTAMPTZ DEFAULT now()
  UNIQUE(empresa_id, telefone)

atendente_ia.conversas
  id                UUID PK DEFAULT gen_random_uuid()
  lead_id           UUID FK → atendente_ia.leads
  empresa_id        UUID FK → atendente_ia.empresas
  status_ia         TEXT DEFAULT 'ativo'  -- 'ativo' | 'pausado'
  pausado_em        TIMESTAMPTZ
  retorno_em        TIMESTAMPTZ  -- preenchido se usar tempo automático
  atualizado_em     TIMESTAMPTZ DEFAULT now()

atendente_ia.chat_histories
  id                BIGSERIAL PK
  session_id        TEXT NOT NULL  -- telefone do lead
  empresa_id        UUID FK → atendente_ia.empresas
  message           JSONB NOT NULL
  criado_em         TIMESTAMPTZ DEFAULT now()
```

### Analytics

```sql
atendente_ia.analytics_eventos
  id                UUID PK DEFAULT gen_random_uuid()
  empresa_id        UUID FK → atendente_ia.empresas
  tipo              TEXT NOT NULL  -- 'agendamento' | 'cancelamento' | 'pausa_ia' | etc
  payload           JSONB
  criado_em         TIMESTAMPTZ DEFAULT now()
```

---

## Endpoints Fastify

### Auth e Tenant

```
POST /auth/register              -- cria empresa + usuário + trial automático
POST /auth/login
POST /auth/logout

GET  /app/empresa                -- dados da empresa autenticada
PUT  /app/empresa

GET  /app/subscription           -- status do plano + trial_ends_at
POST /app/subscription/checkout  -- gera link Stripe Checkout
POST /app/subscription/portal    -- portal Stripe (cancelar/alterar)
```

### Configuração do Bot

```
GET  /app/config                 -- busca config_bot da empresa
PUT  /app/config                 -- salva prompt, tom, palavras-chave, FAQ
POST /app/config/gerar-prompt    -- IA gera prompt com base no tipo de negócio

GET  /app/instancia              -- status da instância + QR code base64
POST /app/instancia              -- cria instância na Evolution API
DELETE /app/instancia            -- desconecta e remove instância
GET  /app/instancia/qr           -- atualiza e retorna novo QR code

GET  /app/gerente                -- números gerente cadastrados
POST /app/gerente                -- adiciona número gerente
DELETE /app/gerente/:id          -- remove número gerente
```

### Agenda e CRM

```
GET    /app/profissionais                          -- lista profissionais
POST   /app/profissionais                          -- cria profissional
PUT    /app/profissionais/:id                      -- edita
DELETE /app/profissionais/:id                      -- desativa

GET  /app/profissionais/:id/grade                  -- grade de horários
PUT  /app/profissionais/:id/grade                  -- salva grade completa
GET  /app/profissionais/:id/bloqueios              -- lista bloqueios
POST /app/profissionais/:id/bloqueios              -- adiciona bloqueio
DELETE /app/profissionais/:id/bloqueios/:bid       -- remove bloqueio

GET    /app/agendamentos                           -- lista (filtro: data, profissional)
POST   /app/agendamentos                           -- cria (valida conflito)
PUT    /app/agendamentos/:id                       -- remarca
DELETE /app/agendamentos/:id                       -- cancela

GET  /app/leads                                    -- CRM — lista leads
GET  /app/leads/:id                                -- detalhe + histórico
```

### Webhooks n8n

```
GET  /webhook/n8n/config/:empresa_id
     → retorna: prompt, tom, palavras-chave, bot_ativo, faq, profissionais ativos

POST /webhook/n8n/agendamento
     body: { empresa_id, lead_telefone, profissional_id, inicio, fim }
     → valida conflito, cria agendamento, retorna confirmação

POST /webhook/n8n/conversa/pausar
POST /webhook/n8n/conversa/reativar
     → atualiza status_ia em atendente_ia.conversas
```

---

## IA de Configuração (dentro do app)

Assistente embutido no app com duas funções:

1. **Configuração guiada** — gera prompt, sugere palavras-chave, horários e FAQ com base no tipo de negócio informado pelo usuário
2. **Suporte ao usuário** — responde dúvidas sobre como usar a plataforma

Endpoint: `POST /app/config/gerar-prompt`
Modelo: `gpt-4.1-mini` (custo baixo, tarefa simples)

---

## Plano de Implementação

### Fase 1 — Banco de Dados
- Criar schema `atendente_ia` no Supabase
- Criar todas as tabelas com migrations Prisma
- Gerar TypeScript types

### Fase 2 — Backend Fastify
- Middleware de tenant isolation (empresa_id do JWT)
- Middleware de trial/subscription guard
- Integração Evolution API (instâncias + QR code)
- Endpoints de configuração, agenda e CRM

### Fase 3 — Webhooks n8n
- `GET /webhook/n8n/config/:empresa_id` com cache Redis
- `POST /webhook/n8n/agendamento` com validação de conflito
- `POST /webhook/n8n/conversa/pausar` e `/reativar`

### Fase 4 — Frontend
- Documentar contratos de API para o Lovable
- Integrar componentes exportados do Lovable em `apps/web/`
- Conectar endpoints
