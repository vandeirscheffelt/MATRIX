# Atendente IA — Status de Desenvolvimento do Backend
> Sessão iniciada em: 2026-04-17
> Última atualização: 2026-04-17 — Todas as 4 fases concluídas ✅
> Atualizar sempre que um item for concluído ou iniciado.

---

## Regra canônica

```
LOVABLE  = Carcaça visual / UX / telas (referência em dissection/shaikron/frontend/)
FASTIFY  = API real / regras / autorização / billing / webhooks  → apps/api/
SUPABASE = Dados / Auth / estado / configurações / CRM / agenda
N8N      = Execução / orquestração / fluxos WhatsApp / IA
STRIPE   = Cobrança / assinatura base + usuários adicionais
```

---

## FASE 1 — Core operacional ✅ CONCLUÍDA

### Schema / Banco ✅
| Item | Status |
|------|--------|
| `atendente_ia.servicos` | ✅ Criado |
| `atendente_ia.profissional_servicos` (M:N) | ✅ Criado |
| `atendente_ia.mensagens_conversa` + enum `origem_mensagem_enum` | ✅ Criado |
| Campos novos em `conversas`: `arquivada`, `resolvida_em`, `ultima_mensagem`, `ultima_atividade` | ✅ Criado |
| Campos novos em `config_bot`: `idioma`, `tipo_negocio`, `contexto_operacional`, `identidade`, `disponibilidade`, `horario_inicio`, `horario_fim` | ✅ Criado |
| Prisma Client regenerado | ✅ |

### Rotas ✅ / ⬜
| Rota | Método | O que faz | Status |
|------|--------|-----------|--------|
| `/app/config/bot-ativo` | PATCH | Toggle rápido da IA no cabeçalho | ✅ |
| `/app/servicos` | GET | Lista serviços ativos ordenados | ✅ |
| `/app/servicos` | POST | Cria serviço (ordem automática) | ✅ |
| `/app/servicos/:id` | PATCH | Edita serviço | ✅ |
| `/app/servicos/:id` | DELETE | Soft delete | ✅ |
| `/app/servicos/reorder` | PATCH | Reordena por array de IDs | ✅ |
| `/app/agenda/day` | GET | Grade do dia com slots DISPONIVEL/AGENDADO/BLOQUEADO | ✅ |
| `/app/agenda/week` | GET | Grade da semana inteira (seg→dom) | ✅ |
| `/app/conversas` | GET | Lista com filtro ativa/arquivada/all + paginação | ✅ |
| `/app/conversas/:id` | GET | Detalhe + mensagens | ✅ |
| `/app/conversas/:id/reply` | POST | Resposta humana manual | ✅ |
| `/app/conversas/:id/pause` | POST | Pausa IA nesta conversa | ✅ |
| `/app/conversas/:id/resume` | POST | Devolve controle à IA | ✅ |
| `/app/conversas/:id/archive` | POST | Arquiva conversa | ✅ |
| `/app/conversas/:id/resolve` | POST | Resolve + arquiva | ✅ |
| `/app/dashboard/overview` | GET | Painel agregado (KPIs do dia) | ✅ |

---

## FASE 2 — Configurações ricas ✅ CONCLUÍDA

### Schema
| Item | Status |
|------|--------|
| `atendente_ia.faq_entries` | ✅ |
| `atendente_ia.faq_sugestoes` | ✅ |
| `atendente_ia.keywords` (por empresa) | ✅ |
| Migrar `config_bot.faq` (JSON) → tabela própria | ⬜ (faq_entries já existe — migração dos dados pendente) |

### Rotas
| Rota | Método | O que faz | Status |
|------|--------|-----------|--------|
| `/app/config/idioma` | PATCH | Altera idioma do bot | ✅ |
| `/app/config/tipo-negocio` | PATCH | Tipo de negócio | ✅ |
| `/app/config/contexto-operacional` | PATCH | Contexto para o prompt | ✅ |
| `/app/config/melhorar-contexto` | POST | IA reescreve o contexto | ✅ |
| `/app/config/tom` | PATCH | Tom de voz (FORMAL/INFORMAL) | ✅ |
| `/app/config/identidade` | PATCH | Assistente virtual vs atendente humano | ✅ |
| `/app/config/horario-comercial` | PATCH | Início/fim do horário | ✅ |
| `/app/config/disponibilidade-ia` | PATCH | horario_comercial / 24_7 / personalizado | ✅ |
| `/app/config/comandos-controle` | PATCH | Palavras de pausa/retorno | ✅ |
| `/app/config/auto-retomada` | PATCH | Tempo automático de retorno | ✅ |
| `/app/faq` | GET/POST | Lista e cria FAQ | ✅ |
| `/app/faq/:id` | PATCH/DELETE | Edita e remove FAQ | ✅ |
| `/app/faq/sugestoes` | GET | Lista sugestões pendentes | ✅ |
| `/app/faq/sugestoes/:id/aprovar` | POST | Aprova sugestão → vira FAQ entry | ✅ |
| `/app/faq/sugestoes/:id/rejeitar` | POST | Rejeita sugestão | ✅ |
| `/app/config/keywords` | GET/POST/DELETE | Palavras-chave do negócio | ✅ |
| `/app/config/keywords/sugerir` | POST | IA sugere keywords via GPT | ✅ |
| `/app/copiloto/score` | GET | Pontuação de configuração 0-100% | ✅ |
| `/app/copiloto/gaps` | GET | Lacunas de configuração com prioridade | ✅ |
| `/app/copiloto/knowledge-gaps` | GET | Perguntas sem resposta no FAQ | ✅ |
| `/app/copiloto/faq/gerar` | POST | Gera sugestões de FAQ das conversas via GPT | ✅ |

---

## FASE 3 — Billing real (Stripe) ✅ CONCLUÍDA

### Schema
| Item | Status |
|------|--------|
| Campos já existem em `subscriptions` | ✅ |

### Rotas
| Rota | Método | O que faz | Status |
|------|--------|-----------|--------|
| `/app/billing/status` | GET | trial/active/expired + dias restantes + usuários extras | ✅ |
| `/app/billing/checkout` | POST | Inicia checkout Stripe (plano base) | ✅ |
| `/app/billing/update-subscription` | POST | Adiciona/remove usuários extras com proration | ✅ |
| `/app/billing/manager-phone` | POST | Salva telefone do gerente | ✅ |
| `/app/billing/portal` | POST | Link portal do cliente Stripe | ✅ |
| `/webhook/stripe/shaikron` | POST | Webhook: paid, failed, canceled, updated | ✅ |

**Variáveis de env necessárias (adicionar ao .env):**
```
STRIPE_PRICE_SHAIKRON_BASE=price_xxx        # Price ID do plano base R$ 97/mês
STRIPE_PRICE_SHAIKRON_USUARIO_EXTRA=price_xxx  # Price ID do usuário extra R$ 29,90/mês
STRIPE_WEBHOOK_SECRET_SHAIKRON=whsec_xxx    # Secret do webhook /webhook/stripe/shaikron
```

**Regras canônicas:**
- Trial: 3 dias sem cartão (automático no signup)
- Plano base: R$ 97,00/mês
- Usuário adicional com IA: R$ 29,90/mês (proration Stripe)
- Uma subscription — `quantity` controla extras
- Trial expirado → bloquear recursos premium

---

## FASE 4 — Admin interno ✅ CONCLUÍDA

### Schema
| Item | Status |
|------|--------|
| `PricingVersion` | ✅ |
| `ExternalProduct` | ✅ |
| `InternalModule` | ✅ |
| Roles: `ADMIN_GLOBAL`, `ACCOUNT_OWNER` | ✅ |

### Rotas
| Rota | O que faz | Status |
|------|-----------|--------|
| `GET/POST /admin/pricing-versions` | Lista e cria versões de preço | ✅ |
| `PATCH /admin/pricing-versions/:id` | Edita versão | ✅ |
| `POST /admin/pricing-versions/:id/apply` | Ativa versão (desativa demais) | ✅ |
| `GET/POST/PATCH/DELETE /admin/products` | CRUD produtos externos | ✅ |
| `PATCH /admin/products/:id/toggle` | Liga/desliga produto | ✅ |
| `GET/POST/PATCH/DELETE /admin/modules` | CRUD módulos internos | ✅ |
| `PATCH /admin/modules/:id/toggle` | Liga/desliga módulo | ✅ |
| `GET /products/public` | Produtos ativos para tenants | ✅ |
| `GET /modules/public` | Módulos ativos para tenants | ✅ |

---

## Arquivos criados nesta sessão

```
apps/api/src/routes/app/
├── config.ts          ← adicionado PATCH /bot-ativo
├── servicos.ts        ← NOVO — CRUD completo
├── agenda.ts          ← NOVO — motor de slots
├── conversas.ts       ← NOVO — CRM operacional
├── dashboard.ts       ← NOVO — overview agregado
├── faq.ts             ← NOVO — FAQ + sugestões IA
├── keywords.ts        ← NOVO — keywords + sugestão GPT
├── copiloto.ts        ← NOVO — score, gaps, knowledge-gaps, gerar FAQ
├── billing.ts         ← NOVO — status, checkout, update-subscription, portal
│
apps/api/src/routes/admin/
├── pricing.ts         ← NOVO — versões de preço
├── products.ts        ← NOVO — produtos externos + rota pública
└── modules.ts         ← NOVO — módulos internos + rota pública

apps/api/src/routes/webhook/
└── stripe-shaikron.ts ← NOVO — webhook paid/failed/canceled/updated

apps/api/src/lib/
└── auth.ts            ← adicionado requireAdminGlobal

packages/database/prisma/
├── schema.prisma      ← atualizado (3 modelos + campos)
└── migrations/
    └── fase1_shaikron.sql  ← aplicado no Supabase
```

---

## Regras que não podem ser esquecidas

1. **Tudo filtrado por `empresaId`** — nunca retornar dados de outro tenant
2. **Conflito de agenda** — já implementado em `agendamentos.ts`, motor de slots usa a mesma lógica
3. **Duração do slot** vem do `profissional.duracaoPadraoMin` (futuro: virá do serviço selecionado)
4. **Pausa da IA** opera em dois níveis: global (`config_bot.bot_ativo`) e por conversa (`conversas.status_ia`)
5. **FAQ hoje é JSON** no `ConfigBot` — migrar na Fase 2 antes de implementar IA02
6. **Trial de 3 dias** inicia automaticamente no signup — não requer cartão
7. **Admin routes** protegidas por role `ADMIN_GLOBAL`, não por `empresaId`
