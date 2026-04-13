# Meta Ads Manager — Contexto Completo para Novo Chat

> Leia este documento antes de qualquer outra coisa.
> Ele representa o estado atual do módulo e as decisões arquiteturais já tomadas.

---

## O que é este app

`apps/meta-ads-manager/` é um backend **Fastify + TypeScript** (porta 3200) que orquestra lançamentos de campanhas no Meta Ads (Facebook/Instagram) a partir de vídeos produzidos no Ateliê.

Ele **não é um app de usuário final** — é um motor interno chamado pelo frontend (Lovable) e pelo n8n.

---

## Stack

- **Runtime:** Node.js + TypeScript (ESM)
- **Framework:** Fastify
- **Banco:** Supabase/PostgreSQL
- **Meta API:** Graph API v21.0 via axios
- **Google Drive:** download de vídeos via service account
- **Schema principal:** `meta_ads` (campanhas, adsets, ads, métricas, regras)
- **Schema ateliê:** `02_atelie` (vídeos produzidos, criativos)

---

## Estrutura de arquivos

```
src/
├── index.ts                   # Fastify entrypoint, porta 3200
├── types/index.ts             # Todos os tipos TypeScript do módulo
├── lib/
│   ├── meta.ts                # Wrappers Meta Graph API
│   ├── atelie.ts              # Acesso ao schema 02_atelie (vídeos)
│   ├── drive.ts               # Download de vídeos do Google Drive
│   └── supabase.ts            # Client Supabase (schema meta_ads)
├── routes/
│   ├── lancamentos.ts         # POST /lancamentos/lancar (SSE) + GET /pendentes
│   ├── campanhas.ts           # CRUD campanhas
│   └── configuracoes.ts       # Config global (mensagem_padrao, whatsapp_number)
├── services/
│   ├── launcher.ts            # Lógica de lançamento batch
│   └── scaler.ts              # Regras de escala/corte automático
└── jobs/
    └── cron-metricas.ts       # Coleta periódica de métricas do Meta
```

---

## Fluxo de lançamento (estado atual)

```
Frontend seleciona campanha + abordagem
        ↓
POST /lancamentos/lancar (SSE stream)
        ↓
Busca vídeos em 02_atelie.videos (status_execucao = 'planejado', plataforma_tipo = 'META_ADS')
        ↓
Para cada vídeo:
  1. Download do Google Drive (drive_file_id)
  2. Upload para Meta (advideos)
  3. Busca thumbnail via API Meta
  4. Cria Creative (object_story_spec com video_data + CTA WHATSAPP_MESSAGE)
  5. Cria Adset (se não existir)
  6. Cria Ad
  7. Marca vídeo como 'publicado' em 02_atelie.videos
        ↓
SSE envia progresso em tempo real para o frontend
```

---

## Decisões arquiteturais já tomadas

### 1. CTA do Creative — campo corrigido

**Antes (bugado):**
```typescript
call_to_action: {
  type: 'WHATSAPP_MESSAGE',
  value: {
    app_destination: 'WHATSAPP',
    whatsapp_message: params.mensagemPreenchida, // ← inválido na Meta API
  }
}
```

**Depois (correto):**
```typescript
call_to_action: {
  type: 'WHATSAPP_MESSAGE',
  value: {
    app_destination: 'WHATSAPP',
    link: `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`,
  }
}
```

### 2. Campo mensagem_wpp na tabela de vídeos

Adicionado: `ALTER TABLE "02_atelie".videos ADD COLUMN mensagem_wpp text;`

Interface `VideoAtelie` atualizada para incluir o campo.

O código de lançamento usa fallback:
```typescript
const mensagemWhatsApp = video.mensagem_wpp ?? `${config.mensagem_padrao} - ${video.video_codigo}`
```

### 3. Quem preenche mensagem_wpp — DECISÃO TOMADA

**O n8n preenche `mensagem_wpp` antes do lançamento**, durante a fase de criação/postagem do vídeo no Ateliê. O meta-ads-manager apenas lê e usa.

Motivo: o n8n já tem acesso a todas as tabelas necessárias e é responsável pelo ciclo de vida do vídeo.

---

## Formato canônico da mensagem (parser n8n)

A mensagem enviada via WhatsApp no CTA deve conter uma linha técnica para rastreio de leads:

```
CP01|MLF|F2|A1|V04||prod_cod
```

| Posição | Campo | Fonte |
|---------|-------|-------|
| 0 | campanha_codigo | `campanhas.campanha_codigo` |
| 1 | origem_codigo | `campanhas_execucao.origem_codigo` (ex: MLF, MLQ, GLF) |
| 2 | fase_codigo | `campanhas_execucao.fase_codigo` (ex: F2, F3) |
| 3 | abordagem_codigo | derivado do `abordagem_codigo` do vídeo (ver mapeamento) |
| 4 | video_codigo | `02_atelie.videos.video_codigo` |
| 5 | dna_referencia | **vazio por enquanto** — módulo futuro |
| 6 | prod_cod | `campanhas.prod_cod` |

**Mapeamento de abordagem:**
- `A1` = Consideração
- `A2` = Decisão
- `A3` = Exploração
- `A4` = Transversal

**O thumbnail (T1) foi removido** — era necessário quando o n8n subia criativos diretamente. Agora o meta-ads-manager busca via API e não precisa estar na mensagem.

**O DNA (posição 5) fica vazio** até o módulo `dna_catalogo` ser implementado. A posição está reservada.

**Parser canônico no n8n** (arquivo: ORIGEM_LEAD):
- Detecta linha técnica com regex `/^CP\d+\|/i`
- Fallback legado: `(GLQ)` ou `(GLQ - CP01)`
- Mapeia `origem_codigo` → `origem_descricao`, `canal_marketing`, `lead_temperatura`

---

## Tabelas envolvidas no módulo

| Schema | Tabela | Uso |
|--------|--------|-----|
| `meta_ads` | `campanhas` | Campanhas gerenciadas, contém `prod_cod`, `campanha_codigo` |
| `meta_ads` | `adsets` | AdSets por campanha |
| `meta_ads` | `ads` | Anúncios individuais |
| `meta_ads` | `metricas_diarias` | Coleta de performance |
| `meta_ads` | `regras_scaler` | Regras de escala/corte automático |
| `meta_ads` | `configuracoes` | `mensagem_padrao`, `whatsapp_number` |
| `meta_ads` | `campanhas_execucao` | Contém `origem_codigo` e `fase_codigo` por execução |
| `02_atelie` | `videos` | Vídeos prontos para lançamento, inclui `mensagem_wpp` |

---

## Variáveis de ambiente necessárias

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=          # com ou sem prefixo act_
META_PAGE_ID=
WHATSAPP_NUMBER=             # número sem formatação
GOOGLE_SERVICE_ACCOUNT_JSON= # JSON da service account
```
