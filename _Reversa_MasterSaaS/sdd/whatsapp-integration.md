# WhatsApp Integration — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Módulo de integração com WhatsApp para comunicação operacional com afiliados. Suporta dois providers: Meta Cloud API (token + phoneNumberId) e Evolution API (QR code). Hoje é completamente mock — token de acesso salvo em localStorage sem criptografia. Em produção, toda configuração deve ser armazenada no banco com criptografia e o webhook deve rotear mensagens para o n8n existente na VPS Matrix.

---

## Responsabilidades

- Conectar instância WhatsApp via Meta Cloud API ou Evolution API 🟡
- Armazenar credenciais criptografadas no banco 🔴 (hoje em localStorage)
- Exibir status de conexão e número conectado 🟡
- Expor URL de webhook para recebimento de mensagens 🟡
- Receber mensagens via webhook e rotear para n8n 🔴
- Enviar mensagens de notificação aos afiliados via n8n 🔴
- Proteger configuração como operação exclusiva de Admin 🟡

---

## Interface

### Tipo `WhatsAppIntegration`

```typescript
type WhatsAppIntegration = {
  id: string
  user_id: string               // FK profiles (admin owner)
  provider: "meta" | "evolution"
  // Meta Cloud API:
  access_token_encrypted: string  // 🔴 hoje em localStorage sem criptografia
  phone_number_id?: string
  // Evolution API:
  instance_name?: string
  // Estado:
  status: "connected" | "disconnected" | "pending" | "qr_pending"
  connected_number?: string      // ex: "+5511999999999"
  webhook_secret_encrypted: string
  connected_at?: string
}
```

### Configuração atual (localStorage — 🔴 RISCO)

```typescript
// Salvo em localStorage("admin.whatsapp.config.v1")
type WhatsAppConfigLS = {
  provider: "meta" | "evolution"
  accessToken?: string           // Meta — em texto puro
  phoneNumberId?: string         // Meta
  status: "connected" | "disconnected" | "pending"
  connectedNumber?: string
}
```

### Endpoints futuros

```typescript
// Admin
GET  /api/admin/whatsapp/integration
POST /api/admin/whatsapp/connect/meta
// body: { access_token: string, phone_number_id: string }
// Valida credenciais na Meta API antes de salvar

POST /api/admin/whatsapp/connect/evolution
// body: { instance_name: string }
// Inicia sessão QR na Evolution API, retorna QR code

GET  /api/admin/whatsapp/status
// Verifica status atual da conexão

DELETE /api/admin/whatsapp/disconnect
// Revoga token e limpa integração

// Webhook público (Meta Cloud API)
POST /api/public/webhook/whatsapp
// Recebe mensagens — verifica HMAC + roteia para n8n

GET  /api/public/webhook/whatsapp
// Verificação de webhook Meta (challenge/verify_token)
```

### Webhook URL exposta na UI

```
https://api.mastersaas.scheffelt.xyz/api/public/webhook/whatsapp
```

---

## Regras de Negócio

- Token de acesso NUNCA deve ficar em localStorage — criptografia obrigatória no banco 🔴
- `access_token_encrypted` usa pgcrypto ou Vault — admin não lê token em texto puro 🟡
- `webhook_secret_encrypted` gerado automaticamente no cadastro da integração 🟡
- Webhook Meta requer verificação de `hub.challenge` no GET antes de receber POST 🟡
- Todo POST de webhook valida assinatura HMAC-SHA256 com `X-Hub-Signature-256` 🟡
- Mensagens recebidas são roteadas para n8n sem processamento direto no backend 🟡
- Evolution API usa QR code para autenticação — polling do status até conectar 🟡
- Apenas um admin pode ser owner da integração (single-tenant por enquanto) 🟡
- Status `qr_pending` indica que QR foi gerado e aguarda scan 🟡
- Timeout de QR: se não scanear em X minutos, status volta para `disconnected` 🟡
- Configuração de WhatsApp restrita a Admin via RBAC 🟢
- `connected_number` exibido mascarado na UI (ex: "+5511 *****-1234") 🟡

---

## Fluxo Principal — Conexão via Meta Cloud API

1. Admin acessa `/admin/whatsapp`
2. Seleciona provider "Meta Cloud API"
3. Preenche `access_token` e `phone_number_id`
4. Clica "Connect"
5. Backend:
   - Valida token na Meta Graph API: `GET /me?access_token=...`
   - Se válido: `access_token_encrypted = encrypt(token)` via pgcrypto
   - Gera `webhook_secret = crypto.randomBytes(32).toString('hex')`
   - INSERT/UPDATE `whatsapp_integrations` com status = 'connected'
6. UI exibe status "Connected" + número conectado + URL do webhook
7. Admin configura webhook URL na Meta Business Suite

## Fluxo Principal — Conexão via Evolution API

1. Admin seleciona "Evolution API"
2. Informa `instance_name`
3. Clica "Connect" → backend inicia instância na Evolution API
4. Backend retorna QR code SVG
5. UI exibe QR em polling (a cada 5s)
6. Admin escaneia com WhatsApp do número desejado
7. Evolution API confirma conexão → webhook notifica backend
8. UPDATE `status = 'connected'`, `connected_number = número detectado`
9. UI exibe "Conectado como +55..."

## Fluxo Principal — Recebimento de Mensagem (Webhook)

1. Meta/Evolution envia POST para `/api/public/webhook/whatsapp`
2. Backend valida `X-Hub-Signature-256` com `timingSafeEqual`
3. Se inválido: retorna 403
4. Extrai payload da mensagem (sender, body, timestamp)
5. `POST http://n8n:5678/webhook/whatsapp-incoming` com payload completo
6. n8n processa: identifica afiliado, aciona fluxo correspondente
7. Backend retorna 200 para Meta/Evolution imediatamente (sem aguardar n8n)

---

## Fluxos Alternativos

- **Token Meta inválido:** `GET /me` retorna erro → backend não salva, retorna 422 com mensagem 🟡
- **QR expirado sem scan:** timeout após X minutos → `status = 'disconnected'`, admin reinicia 🟡
- **Webhook com HMAC inválido:** retorna 403 — não processa payload 🟡
- **n8n indisponível ao rotear mensagem:** retorna 200 para Meta/Evolution mesmo assim (evita retry storm) — registra falha internamente 🟡
- **Desconexão:** DELETE limpa token criptografado + `status = 'disconnected'` 🟡
- **Token expirado (Meta):** webhook começa a falhar → CRON de health check detecta e notifica admin 🟡

---

## Dependências

- `whatsapp_integrations` tabela (banco) — armazenamento criptografado 🔴
- pgcrypto ou Vault (Supabase) — criptografia de tokens 🔴
- Meta Graph API — validação de token + envio de mensagens 🔴
- Evolution API (VPS Matrix) — conexão via QR 🔴
- n8n (VPS Matrix, porta 5678) — roteamento de mensagens 🟢 (já existe)
- `src/routes/admin.whatsapp.tsx` — UI atual (mock) 🟡

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança CRÍTICA | access_token NUNCA em localStorage | ADR-003 | 🟢 |
| Segurança | HMAC-SHA256 em todo webhook recebido | blueprints | 🟡 |
| Segurança | Admin não lê token em texto puro | blueprints | 🟡 |
| Disponibilidade | Backend retorna 200 para webhook imediatamente — não bloqueia em n8n | blueprints | 🟡 |
| Resiliência | Se n8n cai, mensagens são perdidas — considerar fila intermediária | blueprints | 🟡 |
| Performance | Polling de QR: 5s interval — não sobrecarrega Evolution API | inferido do mock | 🟡 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Conexão Meta
Dado que admin informa token válido e phoneNumberId correto
Quando clica "Connect"
Então backend valida na Meta Graph API
E token é salvo criptografado no banco
E UI exibe status "Connected" com número conectado

# Happy path — Webhook recebido e roteado
Dado que Meta envia POST com HMAC válido
Quando webhook é recebido
Então payload é roteado para n8n imediatamente
E backend retorna 200 sem aguardar resposta do n8n

# Falha — Token Meta inválido
Dado que admin informa token expirado ou incorreto
Quando clica "Connect"
Então backend retorna 422 com mensagem "Token inválido"
E nenhuma integração é salva

# Falha — Webhook com HMAC inválido
Dado que POST recebido com X-Hub-Signature-256 incorreto
Quando validação HMAC falha
Então backend retorna 403 Forbidden
E payload não é processado

# Falha — n8n indisponível
Dado que n8n está fora do ar quando mensagem chega
Quando backend tenta rotear
Então backend ainda retorna 200 para Meta/Evolution
E falha é registrada internamente para investigação

# Borda — Estado atual (localStorage)
Dado que admin configura WhatsApp no estado atual
Quando token é salvo
Então fica em localStorage("admin.whatsapp.config.v1") em texto puro
⚠️ Este comportamento DEVE ser eliminado antes de qualquer uso em produção

# Borda — QR expirado
Dado que QR foi gerado mas não foi scanejado em 60 segundos
Quando timeout ocorre
Então status retorna para "disconnected"
E admin deve reiniciar o processo de conexão
```

---

## Cenários de Borda (detalhado)

1. **Token Meta com localStorage (risco imediato):** O access token da Meta Cloud API hoje fica em `localStorage("admin.whatsapp.config.v1")` em texto puro. Qualquer extensão de browser maliciosa ou XSS pode exfiltrar esse token e enviar mensagens em nome da conta. É um risco de sequestro de conta WhatsApp Business. Migração para banco criptografado é **obrigatória antes de qualquer uso real**.

2. **Retry storm da Meta API:** Se backend retornar qualquer status != 200 para webhook da Meta, a Meta reenviará o mesmo evento várias vezes em intervalos crescentes. Para evitar retry storm: sempre retornar 200 ao receber webhook, mesmo que o processamento interno falhe. Registrar falhas internamente via `audit_logs`.

3. **Evolution API QR em loop:** Evolution API em alguns cenários pode gerar QR em loop contínuo sem confirmar conexão. Necessário: timeout máximo de tentativas + mensagem de erro claro para admin tentar novamente. Polling não deve continuar indefinidamente.

4. **Múltiplos admins configurando WhatsApp simultantaneamente:** Dois admins abrem `/admin/whatsapp` ao mesmo tempo e um inicia conexão via Meta enquanto o outro via Evolution. O último a salvar sobrescreve o primeiro. Necessário: lock otimista ou verificação de conflito antes de sobrescrever integração existente.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| Migrar token de localStorage para banco criptografado | Must | Risco de segurança crítico |
| HMAC validation no webhook | Must | Segurança — sem isso qualquer um envia mensagens |
| Roteamento webhook → n8n | Must | Core da integração operacional |
| Retorno 200 imediato para webhook | Must | Evita retry storm da Meta |
| Conexão Meta Cloud API | Should | Provider principal |
| Conexão Evolution API (QR) | Should | Provider alternativo já configurado na VPS |
| Verificação de token antes de salvar | Should | Evita salvar credenciais inválidas |
| Health check de token expirado | Could | Proativo — admin já veria pelos webhooks falhando |
| Fila intermediária antes do n8n | Could | Resiliência — não obrigatório no MVP |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/routes/admin.whatsapp.tsx` | `AdminWhatsappPage` | 🟡 não lido diretamente |
| `src/components/whatsapp-button.tsx` | `WhatsAppButton` (flutuante) | 🟡 não lido diretamente |
| `src/integrations/supabase/auth-middleware.ts` | middleware de auth | 🟡 não lido diretamente |
| Backend whatsapp_integrations | — | 🔴 não existe |
| Backend POST /api/public/webhook/whatsapp | — | 🔴 não existe |
| n8n workflow de WhatsApp | existe na VPS | 🟢 |
