# Shaikron — Atendente IA · ARCHITECTURE.md

> **Fonte da verdade do projeto** — leia este arquivo antes de qualquer módulo.
> **Última atualização:** 2026-05-09
> **Regra:** Atualizar ao concluir cada módulo, ao tomar decisões arquiteturais ou ao resolver bugs relevantes.
> **Propósito:** Qualquer novo chat com Claude deve entender o projeto completo lendo apenas este arquivo.

---

## 0. PROGRESSO DE MÓDULOS

| Módulo | Descrição | Status |
|--------|-----------|--------|
| M01 — Auth & Onboarding | Signup, login, OAuth, reset de senha | ✅ Concluído |
| M02 — Multi-tenancy & Roles | empresaId, ADMIN_GLOBAL, middleware | ✅ Concluído |
| M03 — Configuração do Bot | config_bot, keywords, contexto, horários | ✅ Concluído |
| M04 — Agenda | Profissionais, grade, slots, bloqueios, agendamentos | ✅ Concluído |
| M05 — Serviços | CRUD serviços, reorder, profissional_servicos | ✅ Concluído |
| M06 — CRM / Conversas | Leads, conversas, mensagens, pausa/retomada IA | ✅ Concluído |
| M07 — Copiloto IA | Score, gaps, knowledge-gaps, sugestões FAQ | ✅ Concluído |
| M08 — Admin Panel | pricing-versions, products, modules | ✅ Concluído |
| M09 — Tutoriais | CRUD admin + página pública por categoria | ✅ Concluído |
| M10 — Afiliados | Vitrine MasterSaaS (localStorage → API futura) | ✅ Concluído |
| M11 — Dashboard Real | Wiring hook `useDashboard` → `GET /app/dashboard/overview` | ✅ Concluído |
| M12 — Billing (tela cliente) | Checkout Stripe + portal do cliente | ⬜ Pendente |
| M13 — Integração n8n | Webhooks WhatsApp, leads, conversas, agendamento | ⬜ Pendente |
| M14 — IA02 Analítica | Relatórios e insights de conversas | ⬜ Pendente |

**Conclusão estimada:** 11 / 14 módulos (79%)

---

## 1. O QUE É O PROJETO

**Shaikron** é um SaaS B2B de atendente IA via WhatsApp para PMEs (salões, clínicas, academias, etc).

### Produto

- 4 IAs integradas — ver seção 12 para arquitetura completa de modelos e fluxos
- CRM básico (leads, conversas, histórico de mensagens)
- Agenda multi-profissional com grade de horários
- Billing por assinatura Stripe (trial 3 dias, R$97/mês + R$29,90/usuário extra)
- Painel admin para o operador da holding (ADMIN_GLOBAL)

### Modelo de negócio

| Item | Valor |
|------|-------|
| Trial | 3 dias sem cartão |
| Plano base | R$ 97,00/mês |
| Usuário extra com IA | R$ 29,90/mês (proration Stripe) |
| Granularidade | 1 subscription por empresa, `quantity` controla extras |

---

## 2. ARQUITETURA

```
LOVABLE  = Carcaça visual / UX / telas (referência em dissection/shaikron/frontend/)
FASTIFY  = API real / regras / autorização / billing / webhooks  → apps/api/
SUPABASE = Dados / Auth / estado / configurações / CRM / agenda
N8N      = Execução / orquestração / fluxos WhatsApp / IA
STRIPE   = Cobrança / assinatura base + usuários adicionais
```

### Multi-tenancy

- Tudo filtrado por `empresaId` — nunca retornar dados de outro tenant
- Supabase RLS: **desabilitado** — controle feito no backend (Fastify verifica `empresaId` em cada query)
- Schema dedicado: `atendente_ia.*` — nunca misturar com `public`

### Auth

- **Supabase Auth** — Google OAuth + email/password
- Projeto Supabase: `tbapcaxbawruijrigafn` (renomeado para Shaikron em 2026-04-18)
- Site URL configurada: `https://app.shaikron.scheffelt.xyz`
- Redirect URL OAuth: `https://app.shaikron.scheffelt.xyz`
- ⚠️ **Importante:** Este projeto Supabase é exclusivo do Shaikron. O Calo precisa de projeto próprio.

---

## 3. INFRA / DEPLOY

### VPS (Speedfy)

| Serviço | Container | Porta | URL |
|---------|-----------|-------|-----|
| Frontend | `shaikron-web` Docker | 3005 | https://app.shaikron.scheffelt.xyz |
| API Fastify | `shaikron-api` Docker | 3004 | https://api.shaikron.scheffelt.xyz |
| OpenResty (reverse proxy) | `ic-openresty-1lsg` | 80/443 | — |
| Supabase DB | cloud | — | `db.tbapcaxbawruijrigafn.supabase.co` |

### Docker

- `infra/docker/shaikron/docker-compose.yml` → API (network_mode: host, porta 3004)
- `infra/docker/shaikron/docker-compose.web.yml` → Frontend (porta 3005, build args com VITE_*)
- **Node.js não está instalado na VPS** — build acontece dentro do Docker via Dockerfile
- `apps/shaikron-web/Dockerfile` — multi-stage: node:20-alpine build → nginx:alpine serve

### Como fazer deploy

```bash
# 1. Atualizar código
ssh root@209.50.228.131 'cd /var/www/matrix && git pull origin main'

# 2. Rebuild + restart (frontend)
ssh root@209.50.228.131 'cd /var/www/matrix && docker compose -f infra/docker/shaikron/docker-compose.web.yml build --no-cache && docker compose -f infra/docker/shaikron/docker-compose.web.yml up -d'

# 3. Rebuild + restart (API)
ssh root@209.50.228.131 'cd /var/www/matrix && docker compose -f infra/docker/shaikron/docker-compose.yml build --no-cache && docker compose -f infra/docker/shaikron/docker-compose.yml up -d'
```

- SSH: `root@209.50.228.131` — chave ed25519 configurada localmente em `~/.ssh/id_ed25519`

### OpenResty (nginx)

- Confs em: `/etc/icontainer/apps/openresty/openresty/conf/conf.d/`
- Certs SSL em: `conf/conf.d/certs/shaikron-fullchain.pem` + `shaikron-privkey.pem`
- Cert app: **expira 2026-07-17** — ao renovar, recopiar certs e rodar reload
- Cert api: **expira 2026-07-17**
- **Reload obrigatório via nsenter** (`kill -HUP` não funciona neste ambiente):
  ```bash
  nsenter -t $(pgrep -f openresty | head -1) -m -u -i -n -p -- /usr/local/openresty/nginx/sbin/nginx -s reload
  ```

### Banco de dados — problema IPv6

- **Problema:** Container Docker API é IPv4-only, mas `db.tbapcaxbawruijrigafn.supabase.co` resolve apenas IPv6
- **Solução aplicada:** `network_mode: host` no docker-compose da API — container usa a stack IPv6 da VPS
- Não usar `aws-0-sa-east-1.pooler.supabase.com` (transaction pooler usa formato de user diferente)

---

## 4. STACK TÉCNICA

### Backend (`apps/api/`)

| Camada | Tecnologia |
|--------|-----------|
| Framework | Fastify + TypeScript |
| ORM | Prisma (`@boilerplate/database`) |
| Auth middleware | Supabase Admin SDK (valida JWT) |
| Validação | Zod em todas as rotas |
| Logs | Pino (nunca console.log) |
| Pagamentos | Stripe SDK |

### Frontend (`apps/shaikron-web/`)

| Camada | Tecnologia |
|--------|-----------|
| Framework | Vite + React + TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Auth | Supabase JS client (`src/lib/supabase.ts`) |
| HTTP client | `src/lib/apiClient.ts` — injeta JWT automaticamente |
| Estado | Context API + hooks por domínio (`src/hooks/api/`) |
| Origin | Gerado pelo Lovable, adaptado para API real |

### Variáveis de ambiente da API (VPS: `/var/www/matrix/.env`)

```
NODE_ENV=production
PORT=3004
SUPABASE_URL=https://tbapcaxbawruijrigafn.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://tbapcaxbawruijrigafn.supabase.co  # fallback usado em auth.ts
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://postgres.[ref]:[pass]@db.[ref].supabase.co:5432/postgres
STRIPE_SECRET_KEY=...
STRIPE_PRICE_SHAIKRON_BASE=price_...
STRIPE_PRICE_SHAIKRON_USUARIO_EXTRA=price_...
STRIPE_WEBHOOK_SECRET_SHAIKRON=whsec_...
OPENAI_API_KEY=...
```

### Variáveis de ambiente do Frontend (build args no docker-compose.web.yml)

```
VITE_API_BASE_URL=https://api.shaikron.scheffelt.xyz
VITE_SUPABASE_URL=https://tbapcaxbawruijrigafn.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## 5. SCHEMA DO BANCO

Schema: `atendente_ia`

### Tabelas principais

| Tabela | Descrição |
|--------|-----------|
| `empresas` | Tenant principal — 1 por cliente |
| `usuarios` | Usuários da empresa (`id` = UUID do Supabase Auth) |
| `config_bot` | Configuração da IA por empresa |
| `profissionais` | Profissionais com grade de horários |
| `grade_horarios` | Horários por dia da semana |
| `bloqueios_agenda` | Bloqueios pontuais de agenda |
| `servicos` | Catálogo de serviços |
| `profissional_servicos` | M:N profissional × serviço |
| `agendamentos` | Agendamentos confirmados/remarcados/cancelados |
| `leads` | Contatos via WhatsApp |
| `conversas` | Threads de WhatsApp por lead |
| `mensagens_conversa` | Histórico de mensagens |
| `faq_entries` | Perguntas e respostas do FAQ |
| `faq_sugestoes` | Sugestões geradas pela IA para aprovação |
| `keywords` | Palavras-chave do negócio por empresa |
| `subscriptions` | Assinatura Stripe por empresa |
| `tutorials` | Tutoriais em vídeo por categoria |
| `PricingVersion` | Versões de preço (admin) |
| `ExternalProduct` | Produtos externos (admin) |
| `InternalModule` | Módulos internos (admin) |

### Roles

| Role | Acesso |
|------|--------|
| `ADMIN_GLOBAL` | Painel admin da holding — rotas `/admin/*` |
| `ACCOUNT_OWNER` | Dono da empresa — acesso total ao tenant |
| `MANAGER` | Gerente — acesso operacional |

---

## 6. ROTAS DA API

Prefixo base: `https://api.shaikron.scheffelt.xyz`

### Auth (`/auth`)
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| POST | `/auth/signup` | Cria empresa + usuário + trial | ✅ |
| POST | `/auth/login` | Login email/senha | ✅ |

### App — requer `requireAuth` + `requireActiveSubscription`

**Config (`/app/config`)**
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/app/config` | Configuração completa do bot | ✅ |
| PATCH | `/app/config/bot-ativo` | Toggle rápido da IA | ✅ |
| PATCH | `/app/config/idioma` | Idioma do bot | ✅ |
| PATCH | `/app/config/tipo-negocio` | Tipo de negócio | ✅ |
| PATCH | `/app/config/contexto-operacional` | Contexto para o prompt | ✅ |
| POST | `/app/config/melhorar-contexto` | IA reescreve o contexto (GPT) | ✅ |
| PATCH | `/app/config/tom` | Tom de voz (FORMAL/INFORMAL) | ✅ |
| PATCH | `/app/config/identidade` | Assistente virtual vs humano | ✅ |
| PATCH | `/app/config/horario-comercial` | Horário de funcionamento | ✅ |
| PATCH | `/app/config/disponibilidade-ia` | horario_comercial / 24_7 / personalizado | ✅ |
| PATCH | `/app/config/comandos-controle` | Palavras de pausa/retorno | ✅ |
| PATCH | `/app/config/auto-retomada` | Tempo automático de retorno | ✅ |
| GET/POST | `/app/config/keywords` | Keywords do negócio | ✅ |
| DELETE | `/app/config/keywords/:id` | Remove keyword | ✅ |
| POST | `/app/config/keywords/sugerir` | IA sugere keywords (GPT) | ✅ |

**Serviços (`/app/servicos`)**
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/app/servicos` | Lista serviços ativos | ✅ |
| POST | `/app/servicos` | Cria serviço | ✅ |
| PATCH | `/app/servicos/:id` | Edita serviço | ✅ |
| DELETE | `/app/servicos/:id` | Soft delete | ✅ |
| PATCH | `/app/servicos/reorder` | Reordena por array de IDs | ✅ |

**Agenda (`/app/agenda`)**
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/app/agenda/day?date=YYYY-MM-DD` | Grade do dia — slots por profissional | ✅ |
| GET | `/app/agenda/week?date=YYYY-MM-DD` | Grade da semana inteira | ✅ |

⚠️ **Param obrigatório:** `date` (não `data`) — erro histórico no frontend foi corrigido em 2026-04-18.

**Bloqueios (`/app/bloqueios`)**
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| POST | `/app/bloqueios` | Bloqueia slot pontual | ✅ |
| DELETE | `/app/bloqueios/:id` | Desbloqueia slot | ✅ |

**Agendamentos (`/app/agendamentos`)**
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/app/agendamentos` | Lista agendamentos | ✅ |
| POST | `/app/agendamentos` | Cria agendamento | ✅ |
| PATCH | `/app/agendamentos/:id` | Atualiza status | ✅ |
| DELETE | `/app/agendamentos/:id` | Cancela | ✅ |

**Conversas (`/app/conversas`)**
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/app/conversas` | Lista com filtro + paginação | ✅ |
| GET | `/app/conversas/:id` | Detalhe + mensagens | ✅ |
| POST | `/app/conversas/:id/reply` | Resposta humana manual | ✅ |
| POST | `/app/conversas/:id/pause` | Pausa IA nesta conversa | ✅ |
| POST | `/app/conversas/:id/resume` | Devolve controle à IA | ✅ |
| POST | `/app/conversas/:id/archive` | Arquiva | ✅ |
| POST | `/app/conversas/:id/resolve` | Resolve + arquiva | ✅ |

**Dashboard (`/app/dashboard`)**
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/app/dashboard/overview` | KPIs do dia agregados | ✅ backend / ⬜ frontend wiring |

**FAQ (`/app/faq`)**
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET/POST | `/app/faq` | Lista e cria entradas | ✅ |
| PATCH/DELETE | `/app/faq/:id` | Edita e remove | ✅ |
| GET | `/app/faq/sugestoes` | Sugestões pendentes da IA | ✅ |
| POST | `/app/faq/sugestoes/:id/aprovar` | Aprova sugestão | ✅ |
| POST | `/app/faq/sugestoes/:id/rejeitar` | Rejeita sugestão | ✅ |

**Copiloto (`/app/copiloto`)**
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/app/copiloto/score` | Pontuação de configuração 0-100% | ✅ |
| GET | `/app/copiloto/gaps` | Lacunas de configuração com prioridade | ✅ |
| GET | `/app/copiloto/knowledge-gaps` | Perguntas sem resposta no FAQ | ✅ |
| POST | `/app/copiloto/faq/gerar` | Gera sugestões de FAQ via GPT | ✅ |

**Billing (`/app/billing`)**
| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/app/billing/status` | trial/active/expired + dias restantes | ✅ backend / ⬜ frontend |
| POST | `/app/billing/checkout` | Inicia checkout Stripe | ✅ backend / ⬜ frontend |
| POST | `/app/billing/update-subscription` | Adiciona/remove usuários extras | ✅ backend / ⬜ frontend |
| POST | `/app/billing/manager-phone` | Salva telefone do gerente | ✅ |
| POST | `/app/billing/portal` | Link portal do cliente Stripe | ✅ backend / ⬜ frontend |

### Tutoriais

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/tutorials/public` | Lista tutoriais ativos (público) | ✅ |
| GET/POST | `/admin/tutorials` | CRUD admin de tutoriais | ✅ |
| PATCH/DELETE | `/admin/tutorials/:id` | Edita / remove tutorial | ✅ |

### Admin — requer `requireAdminGlobal` (role ADMIN_GLOBAL)

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET/POST | `/admin/pricing-versions` | Versões de preço | ✅ |
| PATCH | `/admin/pricing-versions/:id` | Edita versão | ✅ |
| POST | `/admin/pricing-versions/:id/apply` | Ativa versão | ✅ |
| GET/POST/PATCH/DELETE | `/admin/products` | CRUD produtos externos | ✅ |
| PATCH | `/admin/products/:id/toggle` | Liga/desliga produto | ✅ |
| GET/POST/PATCH/DELETE | `/admin/modules` | CRUD módulos internos | ✅ |
| PATCH | `/admin/modules/:id/toggle` | Liga/desliga módulo | ✅ |

### Públicas (sem auth)

| Método | Rota | Descrição | Status |
|--------|------|-----------|--------|
| GET | `/products/public` | Produtos ativos para tenants | ✅ |
| GET | `/modules/public` | Módulos ativos para tenants | ✅ |
| GET | `/health` | Health check | ✅ |

### Webhooks

| Rota | Auth | Descrição | Status |
|------|------|-----------|--------|
| POST `/webhook/stripe/shaikron` | Stripe signature | paid, failed, canceled, updated | ✅ backend / ⬜ teste real |
| POST `/webhook/n8n/*` | `x-webhook-secret` | Webhooks do n8n | ⬜ pendente integração n8n |

---

## 7. FRONTEND — HOOKS E CONTEXTOS

### Hooks de API (`src/hooks/api/`)

| Hook | Rota consumida | Status |
|------|---------------|--------|
| `useServices` | `/app/servicos` | ✅ wired |
| `useSettings` | `/app/config` | ✅ wired |
| `useConversations` | `/app/conversas` | ✅ wired |
| `useProfessionals` | `/app/profissionais` | ✅ wired (via ProfessionalsContext) |
| `useAvailability` | `/app/agenda/day` | ✅ wired — cache síncrono |
| `useAppointments` | `/app/agendamentos` | ✅ wired |
| `useDashboard` | `/app/dashboard/overview` | ✅ wired |
| `useBilling` | `/app/billing/status` | ⬜ wiring pendente |

### Decisão arquitetural: `useAvailability` — cache síncrono

- **Problema:** `getSlotsForDate` era `async` mas era chamado em `useMemo` e em múltiplos pontos síncronos no `Agenda.tsx` — causava crash `u.filter is not a function`
- **Solução:** Hook mantém `slotsCache: Record<dateStr, TimeSlot[]>` em estado. `getSlotsForDate(date)` é síncrono (lê do cache), dispara `loadSlotsForDate(date)` em background. Componentes re-renderizam quando o cache atualiza.

### Páginas de autenticação

| Página | Rota | Status |
|--------|------|--------|
| `LoginPage` | `/login` | ✅ Google OAuth + email/senha + lembrar e-mail + esqueci senha |
| `SignupPage` | `/signup` | ✅ Google OAuth + nome + email + senha + confirmar + lembrar e-mail |
| `ResetPasswordPage` | `/reset-password` | ✅ Nova senha + confirmação após link do e-mail |

### Contextos

| Contexto | Propósito |
|----------|-----------|
| `AuthContext` | Sessão Supabase + user info |
| `AiModeContext` | Toggle da IA (global) |
| `ProfessionalsContext` | Cache de profissionais |
| `LanguageContext` | i18n (pt-BR / en / es) |
| `AffiliatesContext` | Vitrine de afiliados (localStorage → API MasterSaaS futura) |

---

## 8. BUGS RESOLVIDOS (histórico relevante)

| Bug | Causa | Solução |
|-----|-------|---------|
| ERR_CERT_COMMON_NAME_INVALID | OpenResty lê de `/etc/icontainer/...`, não `/etc/nginx/` | Copiar certs para path correto do icontainer |
| Reload nginx não funcionava | `kill -HUP` ignorado no namespace do container | Usar `nsenter -t <PID> ...` |
| Google OAuth redirecionava para admin.calo.scheffelt.xyz | Site URL Supabase errada | Corrigida para `app.shaikron.scheffelt.xyz` |
| `supabaseUrl is required` | `auth.ts` lia `NEXT_PUBLIC_SUPABASE_URL` mas VPS só tem `SUPABASE_URL` | Fallback: `process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL` |
| Can't reach database (IPv6) | Container Docker é IPv4-only, Supabase DB resolve só IPv6 | `network_mode: host` no docker-compose da API |
| 400 Bad Request em `/app/agenda/day` | Frontend enviava `?data=` mas API espera `?date=` | Corrigido em `useAvailability.ts` |
| Tela preta antes do login | `getSlotsForDate` async em `useMemo` → Promise.filter crash | Refatorado para cache síncrono |
| 403 Forbidden após login | Usuário não existia em `atendente_ia.usuarios` | Criado empresa + usuario + subscription via psql |
| gmaps-scraper travado | 20.222 jobs em `em_andamento` sem processar | Reset via `UPDATE ... SET status = 'pendente'` |
| OpenResty apontava porta errada | `shaikron-web.conf` tinha porta `5174` (dev Vite) | Corrigido para `3005` (container prod) |
| slotOverrides replicavam entre datas | Estado de bloqueio não era escopado por data | Refatorado para `Record<date, overrides>` |

---

## 9. STATUS ATUAL (2026-05-01)

| Componente | Status |
|-----------|--------|
| Backend — todos os módulos | ✅ Completo e deployado |
| Frontend — hooks wired | ✅ Completo |
| HTTPS frontend | ✅ app.shaikron.scheffelt.xyz |
| HTTPS API | ✅ api.shaikron.scheffelt.xyz |
| Google OAuth | ✅ Funcionando |
| Login / Signup / Reset senha | ✅ Funcionando |
| Agenda com bloqueio de slots | ✅ Funcionando |
| Aba Afiliados | ✅ `/affiliates` — vitrine MasterSaaS |
| Aba Tutoriais | ✅ `/tutorials` — embed YouTube por categoria |
| Admin (pricing, products, modules, tutorials, affiliates) | ✅ Funcionando |
| Dashboard real (hook `useDashboard`) | ✅ Wired e deployado |
| n8n integrado | ⬜ Pendente |
| Billing Stripe (tela cliente) | ⬜ Pendente |

---

## 10. PRÓXIMOS MÓDULOS (em ordem)

1. ~~**M11 — Dashboard Real**~~ ✅ Concluído
2. **M12 — Billing (tela cliente)** — checkout Stripe + portal do cliente
3. **M15 — Gestão de Equipe** — convite de funcionários ao painel web por e-mail (ACCOUNT_OWNER convida MANAGER/RECEPTIONIST); usuário extra dispara cobrança Stripe; implementar junto com M12
3. **M13 — Integração n8n** — fluxos de WhatsApp chamar endpoints de `api.shaikron.scheffelt.xyz`:
   - Criar/atualizar leads e conversas via webhook
   - Salvar mensagens no histórico
   - Verificar `status_ia` da conversa antes de responder
   - Acionar motor de agendamento
   - Enviar resumos para o gerente
4. **M14 — IA02 Analítica** — relatórios, insights de conversas
5. **Afiliados — backend MasterSaaS** — quando MasterSaaS estiver pronto, trocar AffiliatesContext de localStorage para API real
6. **Renovar cert SSL** — expira 2026-07-17, certbot DNS challenge + recopiar para icontainer
7. **Migrar `config_bot.faq` (JSON) → `faq_entries`** — antes de ativar IA02

---

## 11. REGRAS QUE NÃO PODEM SER ESQUECIDAS

1. **Tudo filtrado por `empresaId`** — nunca retornar dados de outro tenant
2. **RLS desabilitado** — o backend é a única barreira de segurança
3. **Supabase é exclusivo do Shaikron** — Calo precisa de projeto próprio
4. **Conflito de agenda** já implementado — motor de slots valida sobreposição
5. **Duração do slot** vem de `profissional.duracaoPadraoMin` (futuro: do serviço)
6. **Pausa da IA** em dois níveis: global (`config_bot.bot_ativo`) e por conversa (`conversas.status_ia`)
7. **Trial de 3 dias** inicia automaticamente no signup — não requer cartão
8. **Admin routes** protegidas por role `ADMIN_GLOBAL`, não por `empresaId`
9. **NUNCA matar portas na VPS** — sempre mudar a porta do novo serviço
10. **Reload nginx via nsenter** — `kill -HUP` não funciona neste ambiente

---

## 12. ARQUITETURA DAS IAs — MODELOS, PAPÉIS E FLUXOS

> Decisões tomadas em 2026-05-09. Fonte da verdade para implementação no n8n.

---

### Visão geral

```
Cliente WhatsApp
      ↓
IA01 — Orquestradora (Gemini 2.5 Flash + Context Cache)
  ├── FAQ / preços / dúvidas → responde direto (contexto no cache)
  └── Agendamento → aciona Agente Agenda (GPT-5 mini)
                         ↓
               Consulta API Fastify
               Devolve opções / confirmação
                         ↓
              IA01 comunica com o cliente
```

---

### IA01 — Orquestradora

| Campo | Valor |
|-------|-------|
| Modelo | Gemini 2.5 Flash |
| Estratégia de custo | Context Caching (Gemini) |
| O que cacheia | System prompt + FAQ + keywords + horários comerciais |
| Cache ID | Salvo em `config_bot.cacheId` — renovado quando config muda |
| Quem gerencia o cache | Fastify — cria/renova cache ao detectar mudança de config |
| FAQ e preços | Respondidos direto pela orquestradora (já no cache — zero chamada extra) |
| Agente Comercial | **Fora do MVP** — preços no FAQ são suficientes por enquanto |

**Papel:** entende a intenção do cliente, aciona especialistas quando necessário, monta e envia a resposta final. É a única IA que fala com o cliente.

> ⚠️ **IA01 NÃO faz vendas ativas.** Ela informa preços e formas de pagamento exatamente como o dono do negócio descrever no FAQ — nada além disso. Argumentação comercial, upsell e negociação são responsabilidade do Módulo Comercial futuro.

---

### Agente Agenda (sub-agente especialista da IA01)

| Campo | Valor |
|-------|-------|
| Modelo | GPT-5 mini (reasoning tokens ativos) |
| Quando é acionado | Somente quando o cliente demonstra intenção de agendar |
| Frequência | Baixa — mas alta criticidade |
| O que recebe da IA01 | Resumo estruturado: "cliente quer corte, próxima quinta, tarde, com Ana" + data/hora atual |

**Fluxo multi-turn (agentic loop):**

```
Turno 1 — Busca disponibilidade:
  GPT-5 mini interpreta pedido em linguagem natural
  → GET /app/agenda/day (consulta slots disponíveis)
  → devolve opções para IA01
  IA01 → cliente: "Tenho 14h, 15h ou 16h na quinta com Ana. Qual prefere?"

Turno 2 — Confirmação:
  Cliente escolhe horário
  IA01 aciona Agente Agenda novamente
  → POST /app/agendamentos (confirma no banco)
  → devolve confirmação para IA01
  IA01 → cliente: "Perfeito! Quinta às 15h com Ana confirmado. ✅"
```

> O GPT-5 mini é acionado apenas para interpretar a linguagem natural do pedido.
> Chamadas subsequentes (após horário estruturado) vão direto à API Fastify — sem LLM extra.

**Implementação no n8n:** AI Agent node com tools + memória PostgreSQL (histórico por cliente).

---

### IA02 — Secretária

| Campo | Valor |
|-------|-------|
| Modelo | A definir |
| Papel | Atua para gerente/profissional (não para o cliente final) |
| Comportamento | Duplo: muda conforme quem está falando (gerente vs profissional) |
| Foco | Agenda, confirmações, organização operacional, visão do profissional |

---

### IA03 — Copiloto (painel interno)

| Campo | Valor |
|-------|-------|
| Modelo | `gpt-5-mini` (configurado e deployado) |
| Onde vive | Painel web Shaikron — não no WhatsApp |
| Papel | Consultora on-demand do dono do negócio |
| Faz | Melhora prompts, sugere FAQ, otimiza fluxos, campanhas, mensagens |
| Quando é chamado | Sob demanda — usuário clica no painel |
| Cache | Não justifica — contexto pequeno, chamadas esporádicas |

---

### IA04 — Analista de Lacunas

| Campo | Valor |
|-------|-------|
| Modelo | Gemini 2.5 Flash-Lite **Flex** |
| Onde vive | n8n — fluxos de background |
| Papel | Analisa conversas, detecta falhas de FAQ, gargalos, padrões de perda de venda |
| Quando roda | Cron job (ex: diário ou semanal) — nunca em tempo real |
| Latência aceitável | Sim — 1 a 15 min de latência do Flex é irrelevante para análise em background |
| Output | Sugestões salvas em `faq_sugestoes` e gaps para o copiloto exibir no painel |
| Por que Flex | 50% mais barato que Standard — tarefas analíticas pesadas (ler muitas conversas) com baixo volume de execuções |

---

### Módulo Comercial — Futuro (add-on pago)

Não faz parte do MVP. Preços e serviços comercializados ficam no FAQ da IA01.

Quando implementado, será um **módulo adicional na assinatura** com:
- Agente Comercial: contorno de objeções, argumentação de vendas
- Sequências de follow-up proativo
- Upsell baseado em histórico do cliente

---

### Resumo de modelos por IA

| IA | Modelo | Onde roda | Custo relativo |
|----|--------|-----------|---------------|
| IA01 Orquestradora | Gemini 2.5 Flash + Cache | n8n (WhatsApp) | Baixo (cache elimina 75-90% dos tokens) |
| Agente Agenda | GPT-5 mini | n8n (sub-agente) | Muito baixo (acionado raramente) |
| IA02 Secretária | A definir | n8n | — |
| IA03 Copiloto | gpt-5-mini | Painel web | Baixo (esporádico) |
| IA04 Analista | Gemini 2.5 Flash-Lite Flex | n8n cron | Mínimo (batch, 50% off) |
