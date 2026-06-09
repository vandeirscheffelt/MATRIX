# Referral Tracking — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Módulo responsável por capturar, persistir e propagar a atribuição de afiliado antes e durante o processo de cadastro e compra. Opera em dois fluxos distintos: **rastreamento de venda** (quem gerou o clique que levou à compra) e **rastreamento de rede** (quem recrutou o novo afiliado). Esses dois fluxos não devem se misturar.

---

## Responsabilidades

- Gerar links rastreáveis de afiliado por produto 🟢
- Gerar links de convite de rede (coafiliado) 🟢
- Capturar `ref_code` via `/join/:code` e persistir antes do cadastro 🟢
- Redirecionar visitante para `/signup` (anônimo) ou `/` (autenticado) ao acessar `/join/:code` 🟢
- Redirecionar com injeção de `ref` e `src` ao acessar `/r/:userId/:productSlug` 🟡 (rota não encontrada no código)
- Registrar clique server-side antes do redirect 🔴 (não implementado)
- Resolver produto e validar se está ativo antes do redirect 🟡
- Garantir first-click: não sobrescrever ref_code já persistido 🟢

---

## Interface

### Funções de Link

```typescript
// Link de venda por produto
buildAffiliateLink(productSlug: string, code?: string): string
// retorna: "https://mastersaas.scheffelt.xyz/r/{code}/{productSlug}"

// Link principal (sem produto específico)
buildMainLink(code?: string): string
// retorna: "https://mastersaas.scheffelt.xyz/r/{code}"

// Link de convite de rede
buildReferralLink(code?: string): string
// retorna: "https://mastersaas.scheffelt.xyz/join/{code}"
```

### Funções de Storage

```typescript
setRefCode(raw: string | null | undefined): void
// Normaliza: UPPERCASE + remove [^A-Z0-9] + slice(16)
// Armazena em localStorage("ref_code")
// Não sobrescreve se já existe (first-click)

getRefCode(): string | null
clearRefCode(): void
markWelcomePending(inviterCode: string): void   // localStorage("ref_welcome_pending")
consumeWelcomePending(): string | null           // lê e remove em uma operação
peekWelcomePending(): string | null              // lê sem remover
```

### Formato src (injetado no redirect)

```
src = "MASTERSAAS|AFIL|{affiliateCode}|{productCode}"
```

---

## Regras de Negócio

- Fluxo de venda (`/r/`) e fluxo de rede (`/join/`) são domínios separados — storage, validações e semântica independentes 🟢
- First-click: `setRefCode` não sobrescreve valor existente no localStorage 🟢
- `setRefCode` normaliza input: UPPERCASE + remove caracteres não-alfanuméricos + limita a 16 chars 🟢
- `/join/:code` redireciona para `/signup` se anônimo, para `/` se já autenticado 🟢
- Usuário já autenticado que acessa `/join/:code` não reatribui seu `referred_by_id` — imutável no banco 🟢
- `referred_by_id` só pode ser gravado uma vez — imutabilidade garantida pelo trigger 🟢
- Rota `/r/:userId/:productSlug` deve resolver produto server-side e registrar clique antes do redirect 🔴 (não implementado — rota ausente ou client-only)
- `src` format canônico: `MASTERSAAS|AFIL|{ref}|{productCode}` — injetado como query param no destino 🟡
- Cookie de 14 dias para `affiliate_parent` 🔴 (constante `PARENT_COOKIE_DAYS` não encontrada no código)
- Auto-compra do próprio afiliado (mesmo customer) deve ser bloqueada 🔴 (não implementado)
- Dedupe de cliques: mesmo IP + mesmo slug em <1 min = 1 clique 🔴 (não implementado)

---

## Fluxo Principal — Captura de Referral (/join/:code)

1. Visitante acessa `https://mastersaas.scheffelt.xyz/join/VAN01`
2. `JoinPage` executa `setRefCode("VAN01")` → normaliza → salva em `localStorage("ref_code")`
3. Verifica estado de auth (`loading`, `user`)
4. Se autenticado → `navigate("/", { replace: true })` (vínculo já está no banco, não muda)
5. Se anônimo → `navigate("/signup", { replace: true })`
6. Em `/signup`: `getRefCode()` exibe banner "Você foi convidado por VAN01"
7. Ao cadastrar: `signUp()` captura `getRefCode()` → envia em `raw_user_meta_data`
8. Trigger resolve `referred_by_id` → `clearRefCode()` + `markWelcomePending()`

## Fluxo Principal — Redirect de Venda (/r/:userId/:productSlug) 🟡

> ⚠️ Rota não encontrada no código atual. Comportamento inferido dos blueprints.

1. Visitante acessa `https://mastersaas.scheffelt.xyz/r/VAN01/schaikron`
2. Sistema deve registrar clique server-side (IP hash, UA hash, timestamp) 🔴
3. Valida se produto `schaikron` existe e `active = true` + `acceptingSubscriptions = true`
4. Resolve `productUrl` do produto
5. Injeta params: `?ref=VAN01&src=MASTERSAAS|AFIL|VAN01|schaikron`
6. Redirect 302 para `productUrl?ref=VAN01&src=...`
7. Se produto inativo: exibe tela de erro com CTAs ("Ver outros produtos" / "Início")

---

## Fluxos Alternativos

- **`setRefCode` com string vazia ou null:** código não salvo, função retorna sem efeito 🟢
- **SSR (window undefined):** todas as funções de storage retornam cedo sem erro 🟢
- **localStorage cheio/bloqueado (modo privado):** try/catch silencioso — atribuição perdida sem notificação 🟢
- **Produto inativo no /r/:** exibe `UnavailableState` com ícone vermelho + 2 CTAs 🟡
- **Usuário acessa /join/CODIGO_INVALIDO:** `setRefCode` salva o código; trigger no banco faz `SELECT` e retorna `null` se não encontrar — `referred_by_id` fica null 🟢
- **Usuário acessa /join/B após ter acessado /join/A:** first-click — A permanece (não sobrescreve) 🟢

---

## Dependências

- `referral-storage.ts` — persistência de ref_code 🟢
- `mock-data.ts` — `buildAffiliateLink`, `buildMainLink`, `baseUrl` 🟢
- `network-data.ts` — `buildReferralLink`, `REFERRAL_RATE` 🟢
- `products-store.ts` — resolução de produto no redirect 🟡
- `use-auth.tsx` — verifica estado de autenticação no `/join/:code` 🟢
- Banco `profiles` — `referred_by_id` gravado pelo trigger 🟢
- Backend API (futuro) — `POST /api/track/click`, `GET /api/r/:userId/:slug` 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança | ref_code normalizado — injection prevention via sanitização | `referral-storage.ts:14` | 🟢 |
| Segurança | referred_by_id imutável — prevenção de fraude pós-cadastro | migration SQL | 🟢 |
| Disponibilidade | try/catch em todo acesso a localStorage — não quebra em modo privado | `referral-storage.ts` | 🟢 |
| Performance | Redirect deve ser server-side para registrar clique antes | 🔴 não implementado | 🔴 |
| Rastreabilidade | Clique deve ser persistido com IP hash + UA hash + timestamp | blueprints | 🔴 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Captura de referral
Dado que um visitante acessa /join/VAN01
Quando a página carrega
Então localStorage("ref_code") contém "VAN01"
E o visitante é redirecionado para /signup

# Happy path — First-click preservado
Dado que localStorage("ref_code") já contém "ANA77"
Quando o visitante acessa /join/VAN01
Então localStorage("ref_code") permanece "ANA77" (não sobrescreve)

# Happy path — Autenticado acessa /join
Dado que um usuário já está autenticado
Quando acessa /join/VAN01
Então é redirecionado para / sem alterar seu referred_by_id

# Happy path — Link de afiliado gerado
Dado que um afiliado tem código "VAN01"
Quando solicita link para o produto "schaikron"
Então o link gerado é "https://mastersaas.scheffelt.xyz/r/VAN01/schaikron"

# Falha — Produto inativo no redirect
Dado que o produto "schaikron" está com active=false
Quando visitante acessa /r/VAN01/schaikron
Então vê tela de produto indisponível com CTAs de navegação

# Falha — Código de afiliado inválido no /join
Dado que "XXXXXX" não é um código válido de afiliado
Quando visitante acessa /join/XXXXXX e completa signup
Então referred_by_id é null (trigger não encontra o código)
E signup é concluído normalmente sem erro

# Borda — localStorage bloqueado
Dado que o browser está em modo privado com localStorage bloqueado
Quando visitante acessa /join/VAN01
Então o erro é silenciado e o visitante é redirecionado para /signup sem referral
```

---

## Cenários de Borda (detalhado)

1. **Cookie de 14 dias não implementado:** O blueprint especifica `PARENT_COOKIE_DAYS = 14` para `affiliate_parent`, mas `referral-storage.ts` só usa localStorage sem TTL. Se o usuário fechar o browser e reabrir, o ref_code persiste indefinidamente (melhor para atribuição) ou até limpar manualmente. Decisão: manter LS como está ou adicionar expiração explícita.

2. **Redirect cross-device:** Usuário clica no link no celular e compra no desktop. O localStorage não persiste entre devices. Atribuição é perdida. Mitigação necessária: validar atribuição server-side via webhook Stripe (não depender de cookie/LS do comprador).

3. **Afiliado clica no próprio link:** `setRefCode(affiliateCode)` → salva no LS → faz login → `referred_by_id` já está no banco (imutável). Auto-referência bloqueada no cadastro, mas auto-compra não está bloqueada. Necessário: verificar `customer_hash` na conversão.

4. **Ref_code com caracteres especiais na URL:** `/join/VAN%2001` → params decoded → `setRefCode("VAN 01")` → normalização remove espaço → salva "VAN01". Comportamento correto.

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| `setRefCode` / `getRefCode` / `clearRefCode` | Must | Pipeline de atribuição — sem isso referral não funciona |
| `buildAffiliateLink` / `buildReferralLink` | Must | Links são o produto entregue ao afiliado |
| `/join/:code` redirect | Must | Entry point de recrutamento de rede |
| First-click (não sobrescrever) | Must | Regra de negócio core — fraude se violada |
| `/r/:userId/:slug` server-side | Must | 🔴 Não implementado — tracking ausente |
| `POST /api/track/click` | Must | 🔴 Não implementado — analytics cegos |
| Cookie de 14 dias (`affiliate_parent`) | Should | Melhora atribuição cross-session |
| Dedupe de cliques | Should | Previne inflação de métricas |
| Bloqueio de auto-compra | Should | Antifraude básico |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/referral-storage.ts` | `setRefCode`, `getRefCode`, `clearRefCode`, `markWelcomePending`, `consumeWelcomePending`, `peekWelcomePending` | 🟢 |
| `src/lib/mock-data.ts` | `buildAffiliateLink`, `buildMainLink`, `baseUrl` | 🟢 |
| `src/lib/network-data.ts` | `buildReferralLink`, `REFERRAL_RATE` | 🟢 |
| `src/routes/join.$code.tsx` | `JoinPage` | 🟢 |
| `src/routes/r.$userId.$productSlug.tsx` | — | 🔴 não encontrado |
