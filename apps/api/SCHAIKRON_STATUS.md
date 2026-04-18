# SCHAIKRON — Status Oficial do Backend
> Documento de referência para não perder o fio da meada.
> Atualizar sempre que um bloco for concluído.
> Última atualização: 2026-04-14

---

## Princípio Canônico

```
LOVABLE  = Carcaça visual / UX / telas (já pronto)
FASTIFY  = API real / regras / autorização / billing / webhooks  ← este repo
SUPABASE = Dados / Auth / estado / configurações / CRM / agenda
N8N      = Execução / orquestração / fluxos WhatsApp / IA
STRIPE   = Cobrança / assinatura base + usuários adicionais
```

---

## O que já existe (FEITO)

### Schema Prisma (`atendente_ia`) — 100% mapeado

| Tabela | Status |
|--------|--------|
| `empresas` — tenant principal | ✅ |
| `usuarios` + enum `role_usuario` | ✅ |
| `subscriptions` + enum `status_subscription` | ✅ |
| `profissionais` + soft delete | ✅ |
| `grade_horarios` — disponibilidade semanal | ✅ |
| `bloqueios` — impedimentos de horário | ✅ |
| `agendamentos` + enum `status_agendamento` | ✅ |
| `instancias_whatsapp` + QR code + enum status | ✅ |
| `config_bot` — prompt, tom, FAQ (JSON), pausa/retorno | ✅ |
| `numeros_gerente` + resumo diário/semanal | ✅ |
| `leads` + unique por empresa+telefone | ✅ |
| `conversas` + enum `status_ia` (ATIVO/PAUSADO) | ✅ |
| `chat_histories` — memória n8n Postgres | ✅ |
| `analytics_eventos` | ✅ |

> **O que FALTA no schema** (ver seção abaixo)

---

### Rotas Fastify existentes

| Rota | Método | O que faz | Status |
|------|--------|-----------|--------|
| `GET /app/empresa` | GET | Dados da empresa | ✅ |
| `PUT /app/empresa` | PUT | Atualiza nome/slug | ✅ |
| `GET /app/profissionais` | GET | Lista profissionais ativos | ✅ |
| `POST /app/profissionais` | POST | Cria profissional | ✅ |
| `PUT /app/profissionais/:id` | PUT | Edita profissional | ✅ |
| `DELETE /app/profissionais/:id` | DELETE | Desativa (soft delete) | ✅ |
| `GET /app/profissionais/:id/grade` | GET | Grade de horários | ✅ |
| `PUT /app/profissionais/:id/grade` | PUT | Substitui grade completa | ✅ |
| `GET /app/profissionais/:id/bloqueios` | GET | Lista bloqueios | ✅ |
| `POST /app/profissionais/:id/bloqueios` | POST | Cria bloqueio | ✅ |
| `DELETE /app/profissionais/:id/bloqueios/:bid` | DELETE | Remove bloqueio | ✅ |
| `GET /app/agendamentos` | GET | Lista com filtro data/profissional | ✅ |
| `POST /app/agendamentos` | POST | Cria + verifica conflito | ✅ |
| `PUT /app/agendamentos/:id` | PUT | Remarca + verifica conflito | ✅ |
| `DELETE /app/agendamentos/:id` | DELETE | Cancela (status CANCELADO) | ✅ |
| `GET /app/config` | GET | Config do bot | ✅ |
| `PUT /app/config` | PUT | Atualiza config (upsert) | ✅ |
| `POST /app/config/gerar-prompt` | POST | Gera prompt com IA (GPT) | ✅ |
| `GET /app/instancia` | GET | Status da instância WA | ✅ |
| `POST /app/instancia` | POST | Cria instância na Evolution API | ✅ |
| `GET /app/instancia/qr` | GET | Atualiza e retorna QR code | ✅ |
| `DELETE /app/instancia` | DELETE | Desconecta e remove | ✅ |
| `POST /webhook/n8n` | POST | Recebe eventos do n8n | ✅ |
| `GET /auth` | GET | Auth Supabase | ✅ |

---

## O que FALTA construir

### Prioridade 1 — Core operacional (bloqueante para funcionar)

#### 1.1 Dashboard agregado
```
GET /app/dashboard/overview
```
Retorna para hidratar o Painel:
- `total_compromissos_hoje`, `proximos_compromissos_count`
- `total_conversas_ativas`, `total_conversas_pendentes`
- `vagas_livres_hoje`, `vagas_bloqueadas_hoje`
- `ia_status` (ativa | pausada)
- `proxima_acao[]` — lista das próximas ações do dia
- `timeline[]` — eventos cronológicos do dia
- `sistema_status`, `whatsapp_status`

#### 1.2 Motor de disponibilidade (Agenda)
```
GET /app/agenda/day?date=YYYY-MM-DD&profissional_id=optional
GET /app/agenda/week?date=YYYY-MM-DD&profissional_id=optional
```
Lógica: grade de horários do profissional − bloqueios − agendamentos existentes = slots disponíveis.
Retorna grade por hora com status: `DISPONIVEL | AGENDADO | BLOQUEADO`.

#### 1.3 Serviços (novo modelo no schema)
```
GET    /app/servicos
POST   /app/servicos
PATCH  /app/servicos/:id
DELETE /app/servicos/:id
PATCH  /app/servicos/reorder
```
**Schema necessário:**
```sql
CREATE TABLE atendente_ia.servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES atendente_ia.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  duracao_min INT NOT NULL DEFAULT 60,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT now()
);
```
> Vínculo profissional ↔ serviços também necessário: `profissional_servicos (profissional_id, servico_id)`

#### 1.4 Conversas (CRM operacional)
```
GET  /app/conversas?status=ativa|arquivada|all
GET  /app/conversas/:id
POST /app/conversas/:id/reply       — resposta humana manual
POST /app/conversas/:id/pause       — assume conversa / pausa IA
POST /app/conversas/:id/resume      — devolve para IA
POST /app/conversas/:id/archive     — arquiva
POST /app/conversas/:id/resolve     — resolve
POST /app/conversas/:id/agendamento — abre fluxo de agendamento
GET  /app/conversas/:id/inteligencia — sugestões / insights
```
**Schema necessário (adicionar ao Prisma):**
- `Conversa` já existe, mas falta: `arquivada: Boolean`, `resolvidaEm: DateTime?`, `ultimaMensagem: String?`
- `MensagemConversa` — tabela nova (as mensagens hoje ficam só no ChatHistory do n8n)
- `InsightConversa` — sugestões da IA02

#### 1.5 Toggle global IA (botão Pausar IA do Painel)
```
PATCH /app/config/bot-ativo
```
Já existe campo `botAtivo` no `ConfigBot`, mas falta rota dedicada para o toggle rápido do cabeçalho.

---

### Prioridade 2 — Configurações completas

#### 2.1 Configurações expandidas do Assistente
O modelo `ConfigBot` atual está limitado. Precisamos expandir com:

**Schema — adicionar campos ao `config_bot`:**
```sql
-- Campos faltantes:
idioma          TEXT NOT NULL DEFAULT 'pt-BR',
tipo_negocio    TEXT,
contexto_operacional TEXT,
identidade      TEXT NOT NULL DEFAULT 'assistente_virtual', -- 'assistente_virtual' | 'atendente_humano'
disponibilidade TEXT NOT NULL DEFAULT 'horario_comercial',  -- 'horario_comercial' | '24_7' | 'personalizado'
horario_inicio  TEXT DEFAULT '08:00',
horario_fim     TEXT DEFAULT '18:00',
keywords        TEXT[] DEFAULT '{}',
```

**Rotas necessárias:**
```
PATCH /app/config/idioma
PATCH /app/config/tipo-negocio
PATCH /app/config/contexto-operacional
POST  /app/config/melhorar-contexto      — chama IA para reescrever
PATCH /app/config/tom
PATCH /app/config/identidade
PATCH /app/config/horario-comercial
PATCH /app/config/disponibilidade-ia
PATCH /app/config/comandos-controle
PATCH /app/config/auto-retomada
```

#### 2.2 Keywords (palavras-chave do negócio)
```
GET    /app/config/keywords
POST   /app/config/keywords
DELETE /app/config/keywords/:id
POST   /app/config/keywords/sugerir      — IA sugere com base no contexto
POST   /app/config/keywords/aplicar-todas
POST   /app/config/keywords/dispensar
```

#### 2.3 FAQ — separar do JSON atual para tabela própria
**Hoje:** FAQ está como JSON no `config_bot.faq` — não escala para sugestões IA02.

**Migração necessária:**
```sql
CREATE TABLE atendente_ia.faq_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES atendente_ia.empresas(id) ON DELETE CASCADE,
  pergunta TEXT NOT NULL,
  resposta TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'sugestao_ia'
  criado_em TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE atendente_ia.faq_sugestoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES atendente_ia.empresas(id) ON DELETE CASCADE,
  pergunta TEXT NOT NULL,
  resposta_sugerida TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente' | 'aprovada' | 'rejeitada'
  origem_conversa_id UUID,
  criado_em TIMESTAMPTZ DEFAULT now()
);
```

**Rotas:**
```
GET    /app/faq
POST   /app/faq
PATCH  /app/faq/:id
DELETE /app/faq/:id
POST   /app/faq/de-sugestao/:sugestao_id
GET    /app/faq/sugestoes
POST   /app/faq/sugestoes/:id/aprovar
POST   /app/faq/sugestoes/:id/rejeitar
```

#### 2.4 Copiloto IA (painel lateral das configurações)
```
GET  /app/copiloto/score              — pontuação de configuração (0-100%)
GET  /app/copiloto/gaps               — lacunas de configuração
GET  /app/copiloto/knowledge-gaps     — perguntas sem resposta nas conversas
POST /app/copiloto/faq/gerar          — gera FAQ das conversas reais
POST /app/copiloto/sugestao/:id/aplicar
```

---

### Prioridade 3 — Billing real

#### 3.1 Billing com Stripe
```
GET  /app/billing/status              — trial/active/expired + dias restantes + resumo mensal
POST /app/billing/checkout            — inicia checkout Stripe (plano base R$ 97/mês)
POST /app/billing/update-subscription — adiciona/remove usuários adicionais (R$ 29,90 cada)
POST /app/billing/manager-phone       — salva telefone do gerente
POST /app/billing/portal              — link portal do cliente Stripe
```

**Regras canônicas de billing:**
- Trial: 3 dias sem cartão (automático no signup)
- Plano base: R$ 97,00/mês
- Usuário adicional com IA: R$ 29,90/mês (proration no Stripe)
- Uma única subscription — `quantity` controla usuários extras
- Após trial expirar: bloquear recursos premium

---

### Prioridade 4 — Admin (interno)

#### 4.1 Painel Admin — Versões de Preço
```
GET   /admin/pricing-versions
POST  /admin/pricing-versions
PATCH /admin/pricing-versions/:id
POST  /admin/pricing-versions/:id/apply
```
**Regra:** apenas uma versão ativa por vez. Clientes antigos não quebram automaticamente — reajuste no aniversário da assinatura.

#### 4.2 Gerenciar Produtos externos
```
GET    /admin/products
POST   /admin/products
PATCH  /admin/products/:id
PATCH  /admin/products/:id/toggle
DELETE /admin/products/:id
GET    /products/public              — versão pública para os tenants
```

#### 4.3 Gerenciar Módulos internos
```
GET    /admin/modules
POST   /admin/modules
PATCH  /admin/modules/:id
PATCH  /admin/modules/:id/toggle
DELETE /admin/modules/:id
GET    /modules/public               — versão pública para os tenants
```

---

### Prioridade 5 — Auth / Roles expandidos

O schema atual tem `RoleUsuario { ADMIN, PROFISSIONAL }`.

**Necessário adicionar:**
- `ADMIN_GLOBAL` — acessa painel admin de preços/produtos/módulos
- `ACCOUNT_OWNER` — dono da conta (gerente principal)
- Middleware de role nas rotas `/admin/*`

---

## Modelos que precisam ser criados no Prisma

| Modelo | Prioridade | Observação |
|--------|-----------|------------|
| `Servico` | P1 | CRUD de serviços por empresa |
| `ProfissionalServico` | P1 | Vínculo M:N profissional ↔ serviço |
| `MensagemConversa` | P1 | Histórico de mensagens por conversa |
| `InsightConversa` | P2 | Sugestões da IA lateral |
| `FaqEntry` | P2 | Substituir JSON do ConfigBot |
| `FaqSugestao` | P2 | Sugestões da IA02 para FAQ |
| `Keyword` | P2 | Palavras-chave por empresa |
| `PricingVersion` | P4 | Versões de preço admin |
| `ExternalProduct` | P4 | Produtos externos admin |
| `InternalModule` | P4 | Módulos internos admin |

---

## Campos a adicionar no ConfigBot (Prisma)

```prisma
model ConfigBot {
  // ... campos existentes ...
  idioma               String   @default("pt-BR")
  tipoNegocio          String?  @map("tipo_negocio")
  contextoOperacional  String?  @map("contexto_operacional") @db.Text
  identidade           String   @default("assistente_virtual")
  disponibilidade      String   @default("horario_comercial")
  horarioInicio        String   @default("08:00") @map("horario_inicio")
  horarioFim           String   @default("18:00") @map("horario_fim")
}
```

---

## Campos a adicionar no model Conversa

```prisma
model Conversa {
  // ... campos existentes ...
  arquivada     Boolean   @default(false)
  resolvidaEm   DateTime? @map("resolvida_em")
  ultimaMensagem String?  @map("ultima_mensagem") @db.Text
  ultimaAtividade DateTime? @map("ultima_atividade")
}
```

---

## Mapa de prioridade de execução

```
FASE 1 (produto funcional mínimo):
  ├─ Schema: Servico + ProfissionalServico + MensagemConversa
  ├─ Motor de disponibilidade (agenda/day + agenda/week)
  ├─ Dashboard overview
  ├─ CRUD de serviços
  ├─ Conversas CRUD + pause/resume/archive/resolve
  └─ Toggle rápido bot-ativo

FASE 2 (configurações ricas):
  ├─ Migrar FAQ de JSON para tabela própria
  ├─ Schema: FaqEntry + FaqSugestao + Keyword
  ├─ Configurações expandidas do assistente (idioma, tipo, tom, etc.)
  ├─ Keywords com sugestão IA
  └─ Copiloto (score + gaps + knowledge-gaps)

FASE 3 (billing real):
  ├─ Stripe checkout (plano base R$ 97)
  ├─ Stripe subscription com quantity (R$ 29,90/extra)
  ├─ Webhook Stripe (paid, canceled, past_due)
  └─ Bloqueio de acesso após trial

FASE 4 (admin interno):
  ├─ Role ADMIN_GLOBAL
  ├─ Versões de preço
  ├─ Produtos externos
  └─ Módulos internos
```

---

## Regras que não podem ser esquecidas

1. **Tudo filtrado por `empresaId`** — nunca retornar dados de outro tenant
2. **Conflito de agenda** — já implementado em `agendamentos.ts`, expandir para o motor de slots
3. **Duração do slot** depende do serviço selecionado, não do profissional
4. **Pausa da IA** opera em dois níveis: global (empresa) e por conversa
5. **FAQ hoje é JSON** no `ConfigBot` — migrar para tabela antes de implementar IA02
6. **Trial de 3 dias** inicia automaticamente no signup — não requer cartão
7. **Proration Stripe** ao adicionar usuário no meio do ciclo — deixar o Stripe calcular
8. **Sugestões de IA** devem respeitar o idioma configurado pela empresa
9. **Simular conexão WA** — manter apenas em `NODE_ENV=development`
10. **Admin routes** protegidas por role `ADMIN_GLOBAL`, não por `empresaId`

---

## Arquivos principais do backend

```
apps/api/src/
├── index.ts                          — servidor Fastify
├── lib/
│   ├── auth.ts                       — requireAuth + requireActiveSubscription
│   ├── supabase.ts                   — cliente Supabase
│   └── stripe.ts                     — cliente Stripe
└── routes/
    └── app/
        ├── agendamentos.ts           ✅ CRUD + conflito
        ├── config.ts                 ✅ ConfigBot + gerar-prompt
        ├── empresa.ts                ✅ GET/PUT empresa
        ├── profissionais.ts          ✅ CRUD + grade + bloqueios
        ├── instancia.ts              ✅ Evolution API + QR
        ├── subscription.ts           ✅ Stripe básico
        ├── gerente.ts                ✅ Número do gerente
        ├── leads.ts                  ✅ CRM básico
        │
        │   -- A CRIAR --
        ├── dashboard.ts              ⬜ overview agregado
        ├── agenda.ts                 ⬜ motor de disponibilidade
        ├── servicos.ts               ⬜ CRUD de serviços
        ├── conversas.ts              ⬜ CRM operacional completo
        ├── faq.ts                    ⬜ FAQ como tabela + sugestões
        ├── keywords.ts               ⬜ palavras-chave + sugestão IA
        └── copiloto.ts               ⬜ score + gaps + knowledge-gaps
```

---

*Documento gerado em 2026-04-14 com base no Documento Fundacional de Handoff Frontend → Backend e na leitura completa do código existente.*
