# Prospecta — GMaps Scraper

Sistema de extração e validação de leads do Google Maps para campanhas de prospecção via WhatsApp.

---

## Visão Geral

O **gmaps-scraper** é um worker autônomo que:

1. Lê uma fila de execuções no banco (combinações de localidade × categoria)
2. Acessa o Google Maps via Puppeteer (modo stealth, headless)
3. Extrai nome, telefone e website de cada estabelecimento
4. Salva os leads únicos no Supabase
5. Valida silenciosamente quais números têm WhatsApp ativo via Evolution API

O resultado é uma base de leads limpa, segmentada e pronta para disparos.

---

## Arquivos

```
apps/gmaps-scraper/
├── index.js          # Worker principal — loop de scraping
├── wa-validator.js   # Worker de validação WhatsApp via Evolution API
├── config.js         # Localidades e categorias alvo
├── supabaseClient.js # Cliente Supabase (schema 03_prospecta)
├── seed.js           # Popula as tabelas execucoes, localidades e categorias
├── dashboard.html    # Dashboard de monitoramento (fonte)
├── index.html        # Cópia do dashboard — servida pelo Netlify na raiz
└── .env              # Variáveis de ambiente (não versionado)
```

---

## Stack

| Tecnologia | Uso |
|---|---|
| Node.js (ESM) | Runtime |
| Puppeteer Extra + Stealth | Scraping do Google Maps |
| Supabase JS v2 | Banco de dados (schema `03_prospecta`) |
| Evolution API v2.3.6 | Validação de números WhatsApp |
| Netlify | Hospedagem do dashboard (HTML estático) |

---

## Banco de Dados — Schema `03_prospecta`

### Tabelas principais

| Tabela | Descrição |
|---|---|
| `localidades` | Bairros/cidades alvo da prospecção |
| `categorias` | Categorias de negócio buscadas |
| `execucoes` | Fila de trabalho: cada linha = 1 combinação localidade × categoria |
| `lead_empresas` | Leads extraídos com dados de contato |

### Colunas relevantes de `lead_empresas`

| Coluna | Tipo | Descrição |
|---|---|---|
| `telefone_wpp` | varchar(15) | Número normalizado para WhatsApp |
| `telefone_raw` | text | Número original extraído do Maps |
| `is_celular` | boolean | Se é celular (DDD + 9 dígitos) |
| `elegivel_wpp` | boolean (generated) | Derivado de `is_celular` |
| `wpp_verificado` | boolean | `true` = WPP ativo, `false` = fixo/inativo, `null` = não verificado |
| `wpp_verificado_em` | timestamp | Data da verificação |
| `disparado` | boolean | Se já recebeu a mensagem de prospecção |
| `respondeu` | boolean | Se respondeu |
| `converteu` | boolean | Se virou cliente |

### Views

| View | Descrição |
|---|---|
| `vw_funil` | Funil completo: total → elegíveis → disparados → responderam → convertidos |
| `vw_validacao` | Contadores de validação WhatsApp: ativos / inativos / pendentes |

---

## Worker de Scraping (`index.js`)

### Fluxo

```
1. Busca execucoes WHERE status = 'pendente' ORDER BY prioridade DESC
2. Verifica janela horária (horario_inicio / horario_fim)
3. Faz lock do job: status → 'em_andamento'
4. Abre Puppeteer → Google Maps → autoScroll até esgotar resultados
5. Extrai nome + telefone + website de cada estabelecimento
6. Insere em massa no Supabase (fallback individual em caso de duplicata)
7. Marca job como 'concluida'
8. Aguarda 2-5 minutos (proteção de IP) e reinicia o loop
```

### Proteções

- **Stealth Plugin:** evita detecção de bot pelo Google
- **Pausa aleatória:** 2-5 minutos entre jobs
- **Lock otimista:** evita dois workers pegarem o mesmo job
- **Janela horária:** pode restringir horário de operação por job

---

## Worker de Validação (`wa-validator.js`)

### Fluxo

```
1. Busca leads WHERE wpp_verificado IS NULL (lote de 5)
2. Normaliza números (garante DDI 55)
3. Deduplica o lote (Evolution API rejeita duplicatas)
4. POST /chat/whatsappNumbers/{instancia} → Evolution API
5. Atualiza wpp_verificado = true/false + wpp_verificado_em = now()
6. Aguarda 6 minutos e repete
7. Encerra ao atingir 250 validações (limite diário)
```

### Configuração atual

| Parâmetro | Valor | Motivo |
|---|---|---|
| `BATCH_SIZE` | 5 | Comportamento discreto |
| `DELAY_MS` | 6 min | Distribuir 250 validações em 24h |
| `DAILY_LIMIT` | 250 | Evitar detecção/banimento |

### Instância Evolution API

- **URL:** `https://evolutionapi.vps1069.panel.speedfy.host`
- **Instância de scraping/disparos:** `Claudia`
- **Instância de validação (recomendado):** chip dedicado separado — nunca o mesmo do disparo

---

## Dashboard

Hospedado no Netlify com deploy automático via GitHub (branch `main`, base dir `apps/gmaps-scraper`).

Seções:
- **Cards de topo:** total execuções / pendentes / concluídas / em andamento / total leads
- **Progresso Geral:** barras de status das execuções
- **Funil de Leads:** total → elegíveis → disparados → responderam → conversas → convertidos
- **Validação WhatsApp:** ativos / inativos / aguardando + barra segmentada visual

Atualiza automaticamente a cada **30 segundos**.

---

## Variáveis de Ambiente (`.env`)

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<service_role_key>

EVOLUTION_API_URL=https://evolutionapi.vps1069.panel.speedfy.host
EVOLUTION_API_KEY=<apikey>
EVOLUTION_INSTANCE=Claudia
```

---

## Como Rodar

### Scraper
```bash
cd apps/gmaps-scraper
node index.js
```

### Validador (rodar uma vez por dia)
```bash
cd apps/gmaps-scraper
node wa-validator.js
```

### Popular fila inicial (seed)
```bash
cd apps/gmaps-scraper
node seed.js
```

---

## Deploy / Atualização do Dashboard

O Netlify está conectado ao GitHub. Qualquer push na branch `main` com alterações em `apps/gmaps-scraper/` atualiza o dashboard automaticamente.

```bash
git add apps/gmaps-scraper/
git commit -m "feat(dashboard): descrição da mudança"
git push
```

---

## Números atuais (05/04/2026)

| Métrica | Valor |
|---|---|
| Total leads extraídos | ~19.573 |
| Elegíveis WhatsApp | ~19.230 (98.2%) |
| WhatsApp ativo (validados) | ~9.465 (48.4%) |
| Fixo / inativo | ~3.435 (17.5%) |
| Aguardando validação | ~6.673 (34.1%) |
| Execuções concluídas | 487 / 624.645 |

---

## Decisões relevantes

- **Supabase Pro** adquirido em 05/04/2026 — free tier (500 MB) esgotado pelo volume de leads + fila de execuções
- **Evolution API** preferida ao Baileys direto — sem chip extra, sem QR Code, chamadas em lote
- **Chip dedicado** para validação recomendado — separar do chip de disparos para proteger a operação principal
- **Netlify** hospeda o dashboard estático — sem backend necessário (lê direto do Supabase via chave anon + views com GRANT SELECT)
