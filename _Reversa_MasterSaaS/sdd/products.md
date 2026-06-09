# Products — SDD
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

Módulo responsável pelo catálogo de produtos SaaS promovíveis. Mantém inventário com pricing multi-currency, copy de vendas multi-locale, taxa de comissão e duração configurável. Hoje persiste em localStorage — destino é tabela `products` no Supabase com CRUD via API Fastify.

---

## Responsabilidades

- Armazenar e servir catálogo de produtos com pricing multi-currency 🟢
- Resolver preço correto por moeda preferida do usuário 🟢
- Persistir CRUD de produtos via localStorage (temporário) 🟢
- Fornecer snapshot de `commissionRate` para cálculo de comissão na venda 🟡
- Expor `sales_copy` multi-locale para o módulo de promoção guiada 🟢
- Controlar visibilidade do produto (`active`) e aceitação de novas assinaturas 🟡
- Bloquear preços duplicados por moeda no mesmo produto 🟢

---

## Interface

### Tipo `Product`

```typescript
type Product = {
  slug: string                    // PK lógica — identificador único
  name: string
  description: string
  tagline?: string
  prices?: Partial<Record<CurrencyCode, number>>  // preferido
  fallbackCurrency?: CurrencyCode  // default: "BRL"
  commissionRate?: number          // 0–100 (%)
  commissionDuration?: "Lifetime" | "12 months" | "6 months" | "3 months" | "Custom"
  customDurationMonths?: number    // se commissionDuration === "Custom"
  billingType?: "Monthly" | "Annual"
  active?: boolean
  acceptingSubscriptions?: boolean // 🔴 ausente no tipo atual — necessário
  coverImage?: string              // base64 ou URL
  productUrl?: string              // 🔴 ausente no tipo atual — necessário para redirect
  productCode?: string             // 🔴 ausente no tipo atual — necessário para src=
  sales_copy?: SalesCopy | SalesCopyByLocale
  // @deprecated:
  price?: number
  currency?: CurrencyCode
}
```

### Tipo `SalesCopy`

```typescript
type SalesCopy = {
  headline: string
  cta: string
  publico: string[]
  mensagens: { a: string; b: string }
  steps: string[]
  vantagem_template: string   // usa {{clicks_per_sale}} como placeholder
}
type SalesCopyByLocale = Partial<Record<Locale, SalesCopy>>
// Locale: "pt" | "en" | "es"
// Fallback: pt → DEFAULT_SALES_COPY
```

### Funções da Store

```typescript
getProducts(): Product[]
setProducts(next: Product[]): void
upsertProduct(product: Product): void        // insert ou update por slug
updateProductBySlug(slug: string, updater: (p: Product) => Product): void
useProducts(): Product[]                      // hook React (useSyncExternalStore)
```

### Função de resolução de preço

```typescript
getProductPrice(product: Product, preferred?: CurrencyCode): { price: number; currency: CurrencyCode }
// Algoritmo:
// 1. Se prices map existe e não está vazio:
//    a. Tenta preferred → se não existe, pickCurrency(prices, undefined, fallback)
//    b. fallback = fallbackCurrency válido ?? "BRL"
// 2. Se prices não existe: retorna {price: product.price ?? 0, currency: product.currency ?? "BRL"}
```

---

## Regras de Negócio

- `slug` é a PK lógica — imutável após criação (renomear quebraria links de afiliado) 🟡
- `prices` map substitui campos `price`/`currency` (deprecated) — ambos coexistem por compatibilidade 🟢
- Moedas duplicadas são bloqueadas por produto (commit `b88e82e`) 🟢
- `commissionRate` é snapshotado no momento da venda — alterações futuras não afetam comissões existentes 🟡
- `commissionDuration = "Lifetime"` → comissão recorrente indefinida enquanto assinatura ativa 🟡
- `commissionDuration = "Custom"` → usa `customDurationMonths` 🟢
- `active = false` → produto não aparece em links ativos, redirect para /r/ exibe tela de erro 🟡
- `acceptingSubscriptions = false` → redirect bloqueado mesmo se produto ativo 🟡
- `sales_copy` por locale: tenta locale do usuário → fallback `"pt"` → DEFAULT_SALES_COPY 🟡
- `vantagem_template` usa `{{clicks_per_sale}}` como placeholder — substituído em runtime pela razão clicks/vendas do afiliado 🟢
- `productUrl` e `productCode` são necessários para o redirect rastreado e para o campo `src` — ausentes no tipo atual 🔴
- Produtos persistidos em localStorage (`"products"`) — SSR retorna `mockProducts` como snapshot 🟢

---

## Fluxo Principal — Resolução de Preço

1. Componente chama `getProductPrice(product, preferredCurrency)`
2. Se `product.prices` existe e tem entradas:
   - Se `preferred` está no mapa → retorna `{price: prices[preferred], currency: preferred}`
   - Senão → `pickCurrency(prices, undefined, fallbackCurrency ?? "BRL")`
3. Se `product.prices` ausente → retorna `{price: product.price ?? 0, currency: product.currency ?? "BRL"}`

## Fluxo Principal — CRUD Admin (atual)

1. Admin acessa `/admin/products`
2. Seleciona produto ou cria novo
3. Preenche form: nome, descrição, URL, código, preços por moeda, commission rate, duração, billing type, toggles, sales_copy por locale, imagem
4. Submit → `upsertProduct(product)` → `setProducts(next)` → `persist(products)` (localStorage)
5. `emit()` notifica todos os subscribers via `useSyncExternalStore`

## Fluxo Principal — CRUD Admin (backend futuro)

1. `POST /api/admin/products` → valida payload com Zod → INSERT em `products` + `product_prices` + `sales_copy_translations`
2. `PUT /api/admin/products/:slug` → UPDATE (não altera slug)
3. `GET /api/products` → SELECT WHERE active = true (público)
4. `GET /api/admin/products` → SELECT todos (admin)

---

## Fluxos Alternativos

- **Produto não encontrado no /r/:** redirect para tela de erro `UnavailableState` 🟡
- **localStorage vazio no primeiro load:** inicializa com `mockProducts` (Schaikron + Scheffelt AI) 🟢
- **Moeda preferida não cadastrada no produto:** `pickCurrency` usa `fallbackCurrency` → BRL 🟢
- **`prices` vazio mas `price` preenchido:** compatibilidade retroativa — usa `price` + `currency` deprecated 🟢
- **SSR server snapshot:** `getServerSnapshot()` retorna `mockProducts` (não LS) — evita mismatch hydration 🟢
- **Upload de imagem:** aceita base64 atualmente — necessário Supabase Storage para produção 🔴

---

## Dependências

- `mock-data.ts` — `mockProducts`, `Product` type, `SalesCopy` type, `getProductPrice` 🟢
- `products-store.ts` — CRUD store com localStorage 🟢
- `i18n.ts` — `CurrencyCode`, `Locale`, `pickCurrency`, `formatMoney` 🟢
- `promotions-store.ts` — `getActivePromotionForProduct` consome `product.slug` 🟢
- `referral-tracking` — `buildAffiliateLink` consome `product.slug` 🟢
- Supabase Storage (futuro) — coverImage 🔴
- Backend API (futuro) — CRUD real 🔴

---

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Consistência | commissionRate snapshotado na venda — imutabilidade histórica | blueprints | 🟡 |
| Disponibilidade | SSR usa mockProducts como fallback — não quebra no servidor | `products-store.ts:45` | 🟢 |
| Segurança | CRUD de produtos restrito a admin via RBAC | 🔴 não implementado | 🔴 |
| Performance | `useSyncExternalStore` com listeners — atualização reativa sem re-render global | `products-store.ts` | 🟢 |
| Storage | coverImage em base64 não escala — CDN obrigatório para >100 produtos | `image-uploader.tsx` | 🟡 |

---

## Critérios de Aceitação

```gherkin
# Happy path — Resolução de preço por moeda
Dado que produto "schaikron" tem prices: {BRL: 49, USD: 12}
Quando usuário com moeda preferida "USD" visualiza o produto
Então preço exibido é 12 USD

# Happy path — Fallback de moeda
Dado que produto "schaikron" tem prices: {BRL: 49} e fallbackCurrency: "BRL"
Quando usuário com moeda preferida "EUR" visualiza o produto
Então preço exibido é 49 BRL (fallback)

# Happy path — Upsert de produto
Dado que admin cria produto com slug "novo-produto"
Quando salva o formulário
Então produto aparece no catálogo e está em localStorage("products")

# Happy path — Moeda duplicada bloqueada
Dado que produto já tem preço em BRL: 49
Quando admin tenta adicionar segundo preço em BRL
Então sistema bloqueia e exibe erro de duplicata

# Falha — Produto sem prices e sem price deprecated
Dado que produto tem prices = {} e price = undefined
Quando getProductPrice é chamado
Então retorna {price: 0, currency: "BRL"}

# Falha — slug duplicado no upsert
Dado que produto com slug "schaikron" já existe
Quando admin cria novo produto com mesmo slug
Então upsertProduct atualiza o existente (não cria duplicata)

# Borda — SSR com localStorage indisponível
Dado que a aplicação está renderizando no servidor
Quando useProducts() é chamado
Então getServerSnapshot() retorna mockProducts sem acessar localStorage

# Borda — commissionRate alterado após venda
Dado que produto tinha commissionRate = 30% quando venda ocorreu
Quando admin altera commissionRate para 20%
Então comissões já geradas permanecem com 30% (snapshot imutável)
```

---

## Cenários de Borda (detalhado)

1. **Slug com caracteres especiais:** Slug é usado em URLs (`/r/VAN01/schaikron`) — deve ser validado como `[a-z0-9-]` apenas. Atualmente não há validação no tipo ou form. Slug inválido quebraria links de afiliado.

2. **Produto deletado com comissões ativas:** Se produto for removido mas houver assinaturas ativas vinculadas, comissões recorrentes ficam órfãs. Necessário: soft-delete (`active = false`, nunca DELETE físico) para preservar integridade referencial.

3. **`vantagem_template` sem dados suficientes:** Se afiliado tem 0 conversões ou <20 cliques, `clicks_per_sale` usa `mockGlobalStats` como fallback (1284/92 ≈ 13.9). Em produção, usar média global real recalculada periodicamente.

4. **Sales copy sem locale do usuário:** Hierarquia: `locale do usuário` → `"pt"` → `DEFAULT_SALES_COPY`. Se nem "pt" estiver definido, produto não exibe copy guiada. Admin deve sempre cadastrar pelo menos a versão "pt".

---

## Prioridade

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| `getProductPrice` multi-currency | Must | Exibição de preço em toda UI |
| `useProducts` / `getProducts` | Must | Consumido por links, promoções, redirect |
| CRUD admin (localStorage) | Must | Único meio atual de gerenciar produtos |
| `commissionRate` snapshot na venda | Must | Integridade financeira core |
| `acceptingSubscriptions` flag | Must | 🔴 ausente no tipo — necessário para redirect |
| `productUrl` e `productCode` | Must | 🔴 ausentes — necessários para redirect rastreado |
| Supabase Storage para coverImage | Should | Base64 não escala |
| Sales copy multi-locale | Should | UX da promoção guiada |
| Soft-delete (active=false) | Should | Integridade com comissões históricas |
| Validação de slug | Could | Prevenção de URLs quebradas |

---

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `src/lib/mock-data.ts` | `Product`, `SalesCopy`, `mockProducts`, `getProductPrice`, `buildAffiliateLink` | 🟢 |
| `src/lib/products-store.ts` | `getProducts`, `setProducts`, `upsertProduct`, `updateProductBySlug`, `useProducts` | 🟢 |
| `src/routes/products.tsx` | `ProductsPage` | 🟡 não lido diretamente |
| `src/routes/admin.products.tsx` | `AdminProductsPage` | 🟡 não lido diretamente |
| `src/components/image-uploader.tsx` | `ImageUploader` | 🟡 não lido diretamente |
