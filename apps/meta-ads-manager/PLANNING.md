# Meta Ads Manager — Planning Document
**Versão:** 1.0  
**Data:** 2026-04-10  
**Status:** Em desenvolvimento

---

## 1. Visão Geral

App para lançamento automático, monitoramento e gestão de campanhas no Meta Ads.  
Integrado ao Ateliê de Criativos e ao CRM via parser `ORIGEM_LEAD`.

**Produto inicial:** Progressiva Vegetal (Lokus)  
**Canal:** Meta Ads → WhatsApp → n8n → CRM

---

## 2. Princípios do Sistema

- **Criativo morre. Abordagem sobrevive.**
- O Meta é só distribuição. Quem decide é o banco.
- Identificação do lead é 100% via carimbo na mensagem do WhatsApp.
- Campanhas são comparadas apenas dentro do mesmo grupo (CP01 vs CP01, CP02 vs CP02).

---

## 3. Arquitetura

```
[Painel React]  ←→  [Backend Fastify Node.js — porta 3200]
                           ↕                    ↕
                    [Meta Marketing API]   [Supabase — schema meta_ads]
                                                ↕
                                         [Google Drive API]
```

---

## 4. Estrutura de Campanha

### Formato atual (isolado — padrão)
```
1 Campanha
  └── 1 AdSet
       └── 1 Vídeo → 3 Anúncios (copies T1, T2, T3)
```
Cada grupo de 24 campanhas representa 1 rodada de testes do Ateliê.

### Formato flexível (configurável por campanha)
```
1 Campanha
  └── N AdSets
       └── N Vídeos → N Copies
```
Permite testar múltiplos vídeos por AdSet quando necessário.

### Identificação do criativo
Nome do anúncio: `CP01_Exploracao_V01_T1`  
Mensagem pré-preenchida no WhatsApp:
```
Olá! Vim pelo anúncio 😊
CP01|MLF|F3|A2|V03|P:a
```
Esse carimbo é interpretado pelo parser `ORIGEM_LEAD` no n8n.

---

## 5. Fases das Campanhas

| Fase | Nome | O que acontece |
|------|------|----------------|
| F2 | Exploração | Vídeos criados, campanhas lançadas, coleta começa |
| F3 | Seleção | CRON avalia, corta 10% piores, redistribui orçamento |
| F4 | Escala | Só campeões, orçamento cresce diariamente |

**Janela padrão de avaliação:** 72h após atingir gasto mínimo configurado  
**Critério de corte:** baseado em `cpl_crm` (custo por lead real do CRM), não só métricas do Meta

---

## 6. Schema do Banco (Supabase — schema `meta_ads`)

| Tabela | Finalidade |
|--------|-----------|
| `campanhas` | Estado e configuração de cada campanha |
| `adsets` | Conjuntos de anúncios por campanha |
| `ads` | Anúncios individuais (vídeo + copy) |
| `metricas_diarias` | Snapshot diário: Meta API + dados reais CRM |
| `regras_scaler` | Regras configuráveis de corte/escala por campanha |
| `scaler_log` | Histórico de todas as ações automáticas |

**Campos chave em `metricas_diarias`:**
- `impressoes`, `cliques`, `gasto`, `ctr`, `cpm` — do Meta API
- `conversas_iniciadas` — do Meta API (`messaging_conversation_started`)
- `leads_crm`, `vendas_crm`, `cpl_crm` — do CRM real (alimentado separadamente)

---

## 7. Endpoints da API (Backend)

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/campanhas` | Lista campanhas com status e resumo |
| GET | `/campanhas/:id` | Detalhe com adsets e ads |
| POST | `/campanhas` | Cria e lança campanha no Meta |
| PATCH | `/campanhas/:id/status` | Pausa / ativa campanha |
| GET | `/campanhas/:id/metricas` | Métricas diárias (param: `?dias=7`) |
| GET | `/campanhas/:id/log` | Histórico de ações do scaler |
| PATCH | `/ads/:id/status` | Pausa / ativa ad individual |
| PATCH | `/adsets/:id/orcamento` | Ajuste manual de orçamento |
| GET | `/regras/:campanha_id` | Lista regras do scaler |
| POST | `/regras` | Cria regra de scaler |
| DELETE | `/regras/:id` | Remove regra |
| GET | `/health` | Health check |

---

## 8. CRON Jobs

| Job | Frequência | Função |
|-----|-----------|--------|
| `cron-metricas` | Diário 06:00 | Coleta métricas do Meta, salva no Supabase, dispara scaler |

---

## 9. Variáveis de Ambiente Necessárias

```env
# Meta
META_ACCESS_TOKEN=        # Token de acesso da Meta Marketing API
META_AD_ACCOUNT_ID=       # ID da conta de anúncios (com ou sem "act_")
META_PAGE_ID=             # ID da página do Facebook

# WhatsApp
WHATSAPP_NUMBER=          # Número com DDI (ex: 5511999999999)

# Já configuradas no .env raiz
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Porta do serviço
META_ADS_PORT=3200
```

---

## 10. Telas do Painel (Frontend — para o Lovable)

### 10.1 Dashboard
- Cards de resumo: campanhas ativas, gasto hoje, leads hoje, CPL médio
- Tabela de campanhas: código, status (badge), fase, gasto acumulado, leads CRM, CPL
- Gráfico de linha: CPL por dia (últimos 7 dias) — Recharts
- Ação rápida por linha: pausar / ativar campanha

### 10.2 Nova Campanha (wizard 3 passos)
- **Passo 1 — Campanha:** código (CPxx), nome, objetivo (MESSAGES / CONVERSIONS), produto, fase
- **Passo 2 — AdSets:** quantidade de adsets, nome, abordagem, orçamento diário, público (JSON livre)
- **Passo 3 — Anúncios:** para cada AdSet: file IDs do Drive, código do vídeo (CPxx_Fy_Vnn), 3 copies (T1/T2/T3)
- Botões: "Salvar rascunho" e "Lançar agora"
- Progress bar no topo

### 10.3 Detalhe da Campanha
- Header: nome, status badge, fase, gasto total, leads, CPL, botão pausar/ativar
- **Tab Anúncios:** tabela de ads com status individual, copy variante, botão pausar/ativar por linha
- **Tab Métricas:** tabela diária (data, impressões, cliques, gasto, CTR, conversas, leads CRM, CPL) + gráfico de linha CPL
- **Tab Regras:** tabela de regras do scaler + formulário de nova regra (tipo, métrica, operador, valor, ação)
- **Tab Log:** tabela do histórico de ações automáticas (data, ação, ad, valor antes/depois, motivo)

### 10.4 Configuração do Scaler (modal por campanha)
- Toggle: scaler automático ligado/desligado
- Lista de regras ativas com delete
- Formulário de nova regra

---

## 11. Especificação Visual (para o Lovable)

```
Tema:       Dark
Background: #0f1117
Cards:      #1e2333
Sidebar:    #161b27
Accent:     #38bdf8
Texto:      #e2e8f0
Danger:     #ef4444
Success:    #22c55e
Warning:    #f59e0b

Componentes: shadcn/ui
Gráficos:    Recharts
Fontes:      Inter
```

**Badges de status:**
- `ativa` → verde (`#22c55e`)
- `pausada` → amarelo (`#f59e0b`)
- `rascunho` → cinza
- `arquivada` → vermelho apagado
- `eliminada` → vermelho (`#ef4444`)

---

## 12. Fluxo Completo (visão sistêmica)

```
Ateliê (n8n)
    ↓ gera vídeos no Google Drive
Painel — Nova Campanha
    ↓ usuário seleciona vídeos, configura adsets e lança
Backend (launcher.ts)
    ↓ Drive → download → upload Meta → creative → ad
Meta Ads (24 campanhas isoladas)
    ↓ usuário clica no anúncio
WhatsApp (mensagem pré-preenchida com carimbo)
    ↓ CP01|MLF|F3|A2|V03|P:a
n8n parser ORIGEM_LEAD
    ↓ decodifica e salva no CRM
CRM (leads_crm, vendas_crm)
    ↓ alimenta metricas_diarias via integração
CRON diário 06:00
    ↓ coleta Meta API + calcula CPL real
Scaler
    ↓ avalia regras → pausa / escala / corta
Painel — Dashboard e Detalhe
    ↓ decisão humana final (escalar para F4, criar CP02...)
```

---

## 13. Roadmap

| Fase | Entregável |
|------|-----------|
| ✅ Concluído | Schema `meta_ads` no Supabase |
| ✅ Concluído | Estrutura do projeto `apps/meta-ads-manager/` |
| 🔲 Próximo | Configurar variáveis Meta no `.env` e testar launcher |
| 🔲 Próximo | Frontend via Lovable + integração com backend |
| 🔲 Próximo | Integração CRM → `metricas_diarias` (leads_crm, vendas_crm) |
| 🔲 Futuro | Google Ads (mesmo padrão, schema `google_ads`) |
| 🔲 Futuro | App Espião (Meta Ad Library API — produto independente) |
| 🔲 Futuro | Exposição como tool do agente Paperclip |
