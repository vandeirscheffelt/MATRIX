# Meta Ads Manager — Checklist de Status

> Atualizado em: 2026-04-12
> Use este documento para saber exatamente o que foi feito e o que falta.

---

## ✅ Concluído

### Backend (meta-ads-manager)
- [x] Estrutura Fastify completa com rotas, services e jobs
- [x] Lançamento de campanhas via SSE (stream de progresso em tempo real)
- [x] Upload de vídeo para Meta via Google Drive → Meta advideos
- [x] Criação de Creative com CTA `WHATSAPP_MESSAGE` (bug do campo corrigido)
  - Campo inválido `whatsapp_message` → substituído por `link: https://wa.me/...`
- [x] Criação de Adset e Ad no Meta
- [x] Marcação de vídeo como `publicado` em `02_atelie.videos`
- [x] Fallback de mensagem: usa `mensagem_wpp` se preenchido, senão padrão
- [x] Scaler automático (regras de corte/escala por métrica)
- [x] Cron de coleta de métricas diárias

### Banco de dados
- [x] `ALTER TABLE "02_atelie".videos ADD COLUMN mensagem_wpp text` — aplicado
- [x] Interface `VideoAtelie` atualizada com campo `mensagem_wpp`
- [x] Campo `mensagem_wpp` incluído no `SELECT` da busca de vídeos

### Arquitetura definida
- [x] Decisão: **n8n preenche `mensagem_wpp`** antes do lançamento (não o meta-ads-manager)
- [x] Formato canônico da mensagem definido: `CP01|MLF|F2|A1|V04||prod_cod`
- [x] Mapeamento de abordagem definido: A1=Consideração, A2=Decisão, A3=Exploração, A4=Transversal
- [x] Thumbnail removido do formato (posição 5 reservada para DNA)
- [x] Parser canônico documentado (regex `/^CP\d+\|/i`)

---

## 🔧 Em andamento / Próximo passo imediato

### n8n — Nó de montagem de mensagem_wpp
- [ ] Criar nó JavaScript no n8n que monta a linha técnica e grava em `02_atelie.videos.mensagem_wpp`
- [ ] Fontes dos dados:
  - `campanhas.campanha_codigo` → posição 0
  - `campanhas_execucao.origem_codigo` → posição 1 (ex: MLF)
  - `campanhas_execucao.fase_codigo` → posição 2 (ex: F2)
  - `abordagem_codigo` do vídeo → mapear para A1/A2/A3/A4 → posição 3
  - `videos.video_codigo` → posição 4
  - posição 5 → vazio (reservado para DNA)
  - `campanhas.prod_cod` → posição 6
- [ ] Chave de join entre `campanhas_execucao` e `02_atelie.videos`: `campanha_id` + `fase_codigo`

---

## ⏳ Pendente (backlog)

### Módulo DNA
- [ ] Definir estrutura da tabela `dna_catalogo`
- [ ] Definir quando e como o `dna_referencia` é atribuído a um vídeo
- [ ] Implementar módulo que preenche posição 5 da mensagem_wpp nos registros existentes
- [ ] Objetivo: identificar qual abordagem + DNA são "campeões" via métricas

### Frontend (Lovable)
- [ ] Tela de gestão de campanhas conectada ao backend
- [ ] Tela de lançamento com seleção de campanha/abordagem (já funciona na interface atual)
- [ ] Visualização de métricas por campanha/adset/ad
- [ ] Interface para configurar regras do scaler

### Plugin Paperclip (meta-ads)
- [ ] Plugin criado e compilado em `plugins/meta-ads/`
- [ ] **Instalação bloqueada** por bug do Paperclip no Windows (path sem `file://`)
- [ ] Após Paperclip ajustado: `paperclipai plugin install --local ./plugins/meta-ads`
- [ ] Após instalar: criar agente "Gestor de Anúncios" no dashboard e atribuir tools
- [ ] Tools disponíveis no plugin:
  - `meta-ads:verify-campaign` — verifica campanha por ID
  - `meta-ads:list-campaigns` — lista campanhas com filtro de status
- [ ] Config necessária no dashboard: `accessTokenSecret` + `adAccountId`

### Outros
- [ ] Substituir `console.log` por Pino em toda a lib `meta.ts`
- [ ] Adicionar campo `prod_cod` ao payload de lançamento (hoje está em `tipos/index.ts` como `produto_codigo` mas não é enviado para o Meta na mensagem)
- [ ] Validar se `campanhas_execucao` já existe no banco ou precisa ser criada

---

## ⚠️ Pontos de atenção

1. **`campanhas_execucao`** — tabela referenciada na arquitetura mas não verificada se existe. Confirmar schema e campos `origem_codigo` + `fase_codigo` antes de implementar o nó n8n.

2. **`prod_cod` vs `produto_codigo`** — o tipo `Campanha` usa `produto_codigo` mas o formato canônico chama de `prod_cod`. Verificar nome real da coluna no banco antes de usar.

3. **Meta Access Token** — token de longa duração (60 dias). Monitorar expiração.

4. **Plugin Paperclip** — aguardando ajuste no Paperclip para suportar paths Windows no `import()`. Código do plugin está pronto em `plugins/meta-ads/`.
