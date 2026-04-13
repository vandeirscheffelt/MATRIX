# Checkpoint — Meta Ads Manager (2026-04-10)

## O que foi construído

### Backend — `apps/meta-ads-manager/` (Fastify porta 3200)

**`src/lib/meta.ts`** — integração completa Meta Marketing API v21.0
- `criarCampanhaMeta` — cria campanha com `OUTCOME_ENGAGEMENT` ou `OUTCOME_SALES`
- `criarAdsetMeta` — cria adset com WhatsApp destination, bid strategy, targeting_automation
- `uploadVideoMeta` — upload de vídeo via FormData
- `buscarThumbnailVideo` — busca thumbnail automático gerado pela Meta (`?fields=thumbnails,picture`)
- `criarCreativeMeta` — cria creative com `image_url` do thumbnail, CTA `WHATSAPP_MESSAGE` sem `link`
- `criarAdMeta` — cria ad
- `buscarMetricasAds`, `atualizarStatusAd`, `atualizarOrcamentoAdset`

**`src/services/launcher.ts`** — fluxo completo de lançamento
- Ordem: Meta primeiro → Supabase só após sucesso (sem registros fantasmas)
- Cascata: Campanha → AdSets → (Drive download → Meta upload → thumbnail → creative → ad)

**`src/routes/campanhas.ts`** — todos os endpoints REST incluindo DELETE com cascata

### Frontend — `apps/meta-ads-web/` (Next.js 14 porta 3201)

- **Dashboard** — Server Component com stats + tabela (usa `router.refresh()` após ações)
- **Campanhas** — Client Component com filtros, checkbox seleção múltipla, bulk delete
- **Nova Campanha** — wizard 3 passos

### Fixes acumulados (Meta API)

| Erro | Fix |
|------|-----|
| `is_adset_budget_sharing_enabled required` | Adicionado `false` no payload |
| `bid_amount required` | `bid_strategy: LOWEST_COST_WITHOUT_CAP` |
| `Página ausente no objeto promovido` | `promoted_object: { page_id }` |
| `A sinalização de público Advantage é obrigatória` | `targeting.targeting_automation: { advantage_audience: 0 }` |
| `interests_note is not a valid target spec field` | Removido via destructuring antes de enviar |
| `Precisa de image_hash ou image_url` | `buscarThumbnailVideo()` → `image_url` |
| `Remova o parâmetro link do WHATSAPP_MESSAGE` | Removido `link` do `value` |
| `Permissão para Páginas insuficiente` | System User MasterWpp adicionado como Anunciante na Página |

## Credenciais configuradas (.env)
```
META_ACCESS_TOKEN=EAARn0h7...  (System User MasterWpp — token de longa duração)
META_AD_ACCOUNT_ID=4102312846692659
META_PAGE_ID=702154982986977
WHATSAPP_NUMBER=5561929843960
META_ADS_PORT=3200
```

## Estado do banco (Supabase schema meta_ads)
- Tabelas: `campanhas`, `adsets`, `ads`, `metricas_diarias`, `regras_scaler`, `scaler_log`
- Estado atual: banco limpo (0 registros) — pronto para lançamento real

## Próximos passos
1. **Testar lançamento real com vídeo do Drive** — informar um `drive_file_id` válido de `CP01_F2_V01.mp4`
2. **Verificar carimbo** — mensagem pré-preenchida no WhatsApp deve chegar como `CP01_F2_V01|T1`
3. **Tela de detalhe** (`/campanhas/:id`) — métricas, log scaler, controles de orçamento por adset
4. **Integração CRM** — alimentar `leads_crm`, `vendas_crm`, `cpl_crm` em `metricas_diarias`
5. **Google Ads** — mesmo padrão, schema `google_ads`

## Como iniciar
```bash
# Backend
cd apps/meta-ads-manager && pnpm dev

# Frontend
cd apps/meta-ads-web && pnpm dev
```
