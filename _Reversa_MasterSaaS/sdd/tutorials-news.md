# Tutorials & News — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Módulo de conteúdo de capacitação e comunicação operacional. Tutoriais ensinam afiliados a usar a plataforma e vender os produtos. News distribui anúncios, orientações e alertas contextuais filtrados por localização na UI. Ambos suportam múltiplos locales (pt-BR, en-US, es-ES). Hoje operam em localStorage/in-memory — destino é banco com CRUD via API.

---

## Responsabilidades

**Tutoriais:**
- Armazenar e servir catálogo de tutoriais por categoria e ordem 🟢
- Extrair YouTube video ID de URLs em múltiplos formatos 🟢
- Rastrear progresso individual por usuário (watched por vídeo) 🟢
- Marcar tutoriais como obrigatórios (`required`) 🟢
- Suportar deep-link CTA para rotas internas 🟢
- CRUD admin com múltiplos locales 🟡

**News:**
- Distribuir notícias/anúncios por `displayLocation` 🟡
- Filtrar news por localização na UI (dashboard, network, products, links, tutorials) 🟡
- Deep-link para tutorial específico ou categoria 🟡
- CRUD admin com prioridade e multi-locale 🟡

---

## Interface

### Tipo `Tutorial`

```typescript
type Tutorial = {
  id: string
  title: string
  description: string
  youtubeUrl: string          // watch?v=, youtu.be/, embed/, shorts/ ou bare ID 11 chars
  category: TutorialCategory
  ctaLabel: string            // label do botão de CTA
  ctaTo: string               // rota interna, ex: "/links"
  order: number               // ordenação dentro da categoria
  active: boolean
  required: boolean
}

type TutorialCategory =
  | "getting-started"
  | "first-sale"
  | "scaling-sales"
  | "campaigns"
```

### Tipo `TutorialProgress`

```typescript
type TutorialProgress = {
  user_id: string         // FK profiles
  tutorial_id: string     // FK tutorials
  completed_at: string    // ISO timestamptz
  watched_seconds?: number // 🟡 inferido — rastrear duração parcial
}
// UK: (user_id, tutorial_id)
```

### Tipo `News` (inferido dos blueprints)

```typescript
type News = {
  id: string
  type: "tutorial" | "live" | "campaign" | "announcement"
  displayLocation: DisplayLocation
  priority: number              // ordem de exibição — menor = mais prioritário
  active: boolean
  deep_link_tutorial_id?: string // FK tutorials (opcional)
  created_at: string
  expires_at?: string
}

type DisplayLocation =
  | "dashboard"
  | "network"
  | "products"
  | "links"
  | "tutorials"

type NewsTranslation = {
  news_id: string
  locale: string              // pt-BR, en-US, es-ES ou qualquer BCP47
  title: string
  body: string
  cta_label?: string
  cta_url?: string
}
```

### Funções de tutoriais

```typescript
getTutorials(): Tutorial[]
setTutorials(next: Tutorial[]): void
upsertTutorial(t: Tutorial): void
deleteTutorial(id: string): void
toggleTutorialActive(id: string): void
useTutorials(): Tutorial[]            // hook React

extractYoutubeId(url: string): string | null
// Formatos suportados:
// 1. Bare ID: /^[a-zA-Z0-9_-]{11}$/ → retorna diretamente
// 2. youtu.be/ID → pathname[0]
// 3. youtube.com?v=ID → searchParam 'v'
// 4. youtube.com/embed/ID → pathname após /embed/
// 5. youtube.com/shorts/ID → pathname após /shorts/
// Fallback: null
```

### Endpoints futuros

```typescript
// Tutoriais
GET  /api/tutorials?locale&category&active=true
POST /api/admin/tutorials
PUT  /api/admin/tutorials/:id
DELETE /api/admin/tutorials/:id

// Progresso
POST /api/me/tutorial-progress
// body: { tutorial_id: string, watched_seconds?: number }
// Upsert por (user_id, tutorial_id)

GET  /api/me/tutorial-progress
// Retorna lista de tutoriais completados pelo usuário autenticado

// News
GET  /api/news?locale&displayLocation&active=true
POST /api/admin/news
PUT  /api/admin/news/:id
DELETE /api/admin/news/:id
```

---

## Regras de Negócio

- Tutoriais organizados em 4 categorias fixas — cada uma tem N tutoriais com `order` numérico 🟢
- `extractYoutubeId` suporta 5 formatos de URL — retorna null se não reconhecer 🟢
- Tutorial `required = true` deve ser concluído antes de marcar progresso nas próximas categorias 🟡
- `TutorialProgress` é upsert por `(user_id, tutorial_id)` — marcar completo é idempotente 🟡
- Progresso atual: apenas `completed` (boolean via localStorage) — sem `watched_seconds` 🟢
- `watched_seconds` é campo futuro para rastrear progresso parcial (inferido) 🟡
- News filtradas por `displayLocation` — cada página exibe apenas as relevantes 🟡
- News com `priority` menor aparecem primeiro — admin controla ordenação 🟡
- News com `expires_at` passado não devem ser servidas 🟡
- Deep-link de news para tutorial: clique navega para `/tutorials` e foca na categoria/vídeo 🟡
- Locale de fallback para tutoriais: locale do usuário → `pt-BR` → DEFAULT_LOCALE 🟡
- `DEFAULT_LOCALE = "pt-BR"` 🟢
- CRUD de tutoriais e news é exclusivo de Admin 🟢

---

## Fluxo Principal — Exibição de Tutoriais (Afiliado)

1. Afiliado acessa `/tutorials`
2. `GET /api/tutorials?locale=pt-BR&active=true`
3. Agrupados por categoria → exibe tabs: Getting Started / First Sale / Scaling Sales / Campaigns
4. Para cada tutorial: card com thumbnail YouTube, badge "Required", botão "Mark complete"
5. `GET /api/me/tutorial-progress` → marca visualmente os já completados
6. Afiliado assiste → clica "Mark complete"
7. `POST /api/me/tutorial-progress` com `tutorial_id`
8. Card atualizado com estado completado

## Fluxo Principal — Exibição de News (NewsGuidanceRail)

1. Componente `NewsGuidanceRail` renderiza em múltiplas páginas
2. Recebe `displayLocation` como prop (ex: `"dashboard"`)
3. `GET /api/news?displayLocation=dashboard&locale=pt-BR&active=true`
4. Filtra por `expires_at > now()` e ordena por `priority ASC`
5. Renderiza banners contextuais com CTA
6. Se `deep_link_tutorial_id` presente: CTA navega para tutorial específico

## Fluxo Principal — CRUD Admin (Tutoriais)

1. Admin acessa `/admin/tutorials`
2. Lista tutoriais com filtros por categoria e status
3. Cria/edita: título, descrição, YouTube URL, categoria, ordem, CTA, active, required
4. Para cada locale (pt-BR, en-US, es-ES): tabs separadas no form
5. `POST /api/admin/tutorials` → valida, persiste, retorna tutorial criado
6. `extractYoutubeId(youtubeUrl)` valida o URL — salva `video_id` extraído

---

## Fluxos Alternativos

- **`extractYoutubeId` com URL inválida:** retorna `null` → campo de thumbnail vazio, tutorial ainda salvo 🟢
- **Tutorial sem tradução no locale do usuário:** fallback para `pt-BR` → se também ausente, exibe em branco ou oculta 🟡
- **News expirada:** `expires_at < now()` → não exibida mesmo se `active = true` 🟡
- **Progresso já marcado (re-click):** upsert idempotente — `completed_at` não atualizado se já existe 🟡
- **Tutorial deletado com progresso existente:** ON DELETE CASCADE em `tutorial_progress` — progresso é removido 🟡
- **Categoria sem tutoriais ativos:** tab exibida mas vazia — ou ocultar tab se vazia 🟡

---

## Dependências

- `tutorials-store.ts` — CRUD + `extractYoutubeId` 🟢
- `progress-store.ts` — tracking de watched por vídeo (localStorage atual) 🟢
- `watched-videos-store.ts` — estado de vídeos assistidos 🟢
- `news-store.ts` — CRUD de news (localStorage atual) 🟢
- `alerts-data.ts` — consome news para `NewsGuidanceRail` 🟡
- Backend API (futuro) — CRUD real + progresso server-side 🔴
- Supabase Storage (futuro) — thumbnails próprios (hoje: YouTube embed) 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Performance | YouTube embed — sem upload de vídeo próprio, CDN do YT | `tutorials-store.ts` | 🟢 |
| i18n | Tutoriais e news multi-locale com fallback pt-BR | `tutorials-store.ts:DEFAULT_LOCALE` | 🟢 |
| Disponibilidade | Progresso em localStorage perde-se ao trocar device | `progress-store.ts` | 🟢 |
| Segurança | CRUD restrito a Admin via RBAC | permissions.md | 🟡 |
| Escalabilidade | i18n.ts com 2.4k chaves — code-split por locale futuro | `i18n.ts` | 🟡 |

---

## Critérios de Aceitação

```gherkin
# Happy path — extractYoutubeId formatos
Dado URL "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
Quando extractYoutubeId é chamado
Então retorna "dQw4w9WgXcQ"

Dado URL "https://youtu.be/dQw4w9WgXcQ"
Quando extractYoutubeId é chamado
Então retorna "dQw4w9WgXcQ"

Dado bare ID "dQw4w9WgXcQ"
Quando extractYoutubeId é chamado
Então retorna "dQw4w9WgXcQ"

Dado URL inválida "https://vimeo.com/123456"
Quando extractYoutubeId é chamado
Então retorna null

# Happy path — Marcar tutorial como completo
Dado que afiliado assiste tutorial "gs-1"
Quando clica "Mark complete"
Então POST /api/me/tutorial-progress com tutorial_id = "gs-1"
E card exibe estado completado
E próxima chamada GET /api/me/tutorial-progress inclui "gs-1"

# Happy path — Idempotência de progresso
Dado que afiliado já completou tutorial "gs-1"
Quando clica "Mark complete" novamente
Então upsert não cria duplicata — retorna 200 com registro existente

# Happy path — News por displayLocation
Dado que NewsGuidanceRail renderiza na dashboard
Quando GET /api/news?displayLocation=dashboard é chamado
Então retorna apenas news com displayLocation = "dashboard"
E ordena por priority ASC
E exclui news com expires_at < now()

# Falha — Tutorial sem tradução no locale
Dado que tutorial "gs-1" tem apenas tradução "pt-BR"
Quando usuário com locale "en-US" acessa
Então fallback exibe versão "pt-BR"

# Borda — Tutorial required não concluído
Dado que tutorial "gs-1" tem required = true e afiliado não completou
Quando acessa próxima categoria
Então 🟡 comportamento não definido no código — deve exibir aviso ou bloquear
```

---

## Cenários de Borda (detalhado)

1. **Progresso perdido ao trocar device:** Estado atual em localStorage — afiliado que acessa de outro browser ou device vê tutoriais como não completados. Migração para banco é obrigatória para persistência real.

2. **YouTube URL de vídeo privado/removido:** `extractYoutubeId` extrai o ID corretamente, mas thumbnail e embed falham no browser. Admin deve ser alertado ao cadastrar URL inválida. Sugestão: validar URL via YouTube oEmbed API antes de salvar.

3. **News com deep-link para tutorial deletado:** Se `deep_link_tutorial_id` referencia tutorial deletado, deep-link quebra silenciosamente. Necessário: FK com `ON DELETE SET NULL` + validação no CRUD de news ao deletar tutorial.

4. **Muitos tutoriais obrigatórios não concluídos:** Se admin marca 10 tutoriais como `required` e nenhum foi concluído, UI não tem comportamento definido para bloqueio de progresso. Decisão de produto necessária: bloquear acesso a funcionalidades ou apenas exibir aviso.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| `extractYoutubeId` multi-formato | Must | Base para qualquer tutorial funcionar |
| CRUD de tutoriais (admin) | Must | Conteúdo de capacitação é core do produto |
| `tutorial_progress` server-side | Must | Progresso perde-se no device atual |
| News com `displayLocation` | Should | Comunicação contextual com afiliados |
| Multi-locale para tutoriais | Should | LATAM requer pt + es no mínimo |
| Multi-locale para news | Should | Consistência com tutoriais |
| Deep-link news → tutorial | Could | UX de orientação guiada |
| Required tutorial enforcement | Could | Decisão de produto pendente |
| `watched_seconds` parcial | Could | Analytics avançado — não obrigatório |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/tutorials-store.ts` | `Tutorial`, `TutorialCategory`, `extractYoutubeId`, `upsertTutorial`, `deleteTutorial`, `toggleTutorialActive`, `useTutorials` | 🟢 |
| `src/lib/progress-store.ts` | progresso de tutoriais | 🟡 não lido diretamente |
| `src/lib/watched-videos-store.ts` | tracking de vídeos assistidos | 🟡 não lido diretamente |
| `src/lib/news-store.ts` | CRUD de news | 🟡 não lido diretamente |
| `src/routes/tutorials.tsx` | `TutorialsPage` | 🟡 não lido diretamente |
| `src/routes/admin.tutorials.tsx` | `AdminTutorialsPage` | 🟡 não lido diretamente |
| `src/routes/admin.news.tsx` | `AdminNewsPage` | 🟡 não lido diretamente |
| `src/components/news-guidance-rail.tsx` | `NewsGuidanceRail` | 🟡 não lido diretamente |
