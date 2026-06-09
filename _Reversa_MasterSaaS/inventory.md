# Inventário — MasterSaaS Frontend
> Gerado pelo Scout (Reversa v1.2.14) em 2026-06-08
> Projeto em: `apps/mastersaas/frontend/`

---

## Estrutura de Pastas

```
apps/mastersaas/frontend/
├── src/
│   ├── components/
│   │   ├── ui/                    # 44 componentes shadcn/ui
│   │   ├── active-campaigns.tsx
│   │   ├── affiliate-progress.tsx
│   │   ├── app-sidebar.tsx
│   │   ├── contextual-alerts.tsx
│   │   ├── copy-button.tsx
│   │   ├── growth-engine.tsx
│   │   ├── guided-promotion-dialog.tsx
│   │   ├── image-uploader.tsx
│   │   ├── income-breakdown.tsx
│   │   ├── insights-alerts-section.tsx
│   │   ├── news-guidance-rail.tsx
│   │   ├── notifications-bell.tsx
│   │   ├── performance-boost-widget.tsx
│   │   ├── potential-earnings.tsx
│   │   ├── promo-countdown.tsx
│   │   ├── promote-button.tsx
│   │   ├── top-affiliates.tsx
│   │   ├── urgency-badge.tsx
│   │   ├── welcome-referral-banner.tsx
│   │   └── whatsapp-button.tsx
│   ├── hooks/
│   │   ├── use-auth.tsx
│   │   ├── use-inviter.ts
│   │   ├── use-locale.ts
│   │   └── use-mobile.tsx
│   ├── integrations/
│   │   ├── lovable/index.ts
│   │   └── supabase/
│   │       ├── auth-middleware.ts
│   │       ├── client.server.ts
│   │       ├── client.ts
│   │       └── types.ts
│   ├── lib/
│   │   ├── admin-finance-data.ts   # mock: comissões + saques admin
│   │   ├── admin-sales-data.ts     # mock: vendas globais
│   │   ├── alerts-data.ts          # smart alerts / insights
│   │   ├── geo.ts                  # detecção de moeda por IP
│   │   ├── i18n.ts                 # ~2.4k chaves pt/en/es
│   │   ├── mock-data.ts            # dados mock centrais
│   │   ├── network-data.ts         # mock: referrals, recruiters
│   │   ├── network-settings-store.ts  # store: regras de rede (in-memory)
│   │   ├── news-store.ts           # store: notícias (localStorage)
│   │   ├── products-store.ts       # store: produtos (localStorage)
│   │   ├── progress-store.ts       # store: progresso de tutoriais
│   │   ├── promotions-store.ts     # store: promoções (in-memory)
│   │   ├── ranking-data.ts         # mock: leaderboard
│   │   ├── referral-storage.ts     # cookie 14d + localStorage para atribuição
│   │   ├── sales-copy.ts           # copy multi-locale por produto
│   │   ├── tutorials-store.ts      # store: tutoriais (localStorage)
│   │   ├── utils.ts                # helpers gerais (cn, etc)
│   │   └── watched-videos-store.ts # store: vídeos assistidos (localStorage)
│   ├── routes/
│   │   ├── __root.tsx              # layout raiz
│   │   ├── index.tsx               # / Dashboard afiliado
│   │   ├── account.tsx             # /account Perfil
│   │   ├── admin.finance.tsx       # /admin/finance (1710 LOC) ← mais complexa
│   │   ├── admin.network.tsx       # /admin/network
│   │   ├── admin.news.tsx          # /admin/news
│   │   ├── admin.products.tsx      # /admin/products
│   │   ├── admin.reports.tsx       # /admin/reports
│   │   ├── admin.sales.tsx         # /admin/sales
│   │   ├── admin.tutorials.tsx     # /admin/tutorials
│   │   ├── admin.whatsapp.tsx      # /admin/whatsapp
│   │   ├── finance.tsx             # /finance
│   │   ├── join.$code.tsx          # /join/:code (referral capture)
│   │   ├── links.tsx               # /links
│   │   ├── login.tsx               # /login
│   │   ├── network.tsx             # /network
│   │   ├── products.tsx            # /products
│   │   ├── promotions.tsx          # /promotions
│   │   ├── sales.tsx               # /sales
│   │   ├── signup.tsx              # /signup
│   │   └── tutorials.tsx           # /tutorials
│   ├── router.tsx
│   ├── routeTree.gen.ts            # gerado pelo TanStack Router
│   └── styles.css
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 20260421201903_*.sql    # profiles, triggers, affiliate_code
│       └── 20260421201938_*.sql    # patch: profiles_prevent_immutable_changes + generate_affiliate_code (SECURITY DEFINER)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── eslint.config.js
├── components.json                 # shadcn/ui config
├── wrangler.jsonc                  # Cloudflare Workers config
└── bun.lockb
```

---

## Módulos Identificados

| # | Módulo | Rota(s) | Tipo | Estado atual |
|---|--------|---------|------|-------------|
| 1 | **Auth** | `/login`, `/signup` | Real (Supabase) | ✅ Funcional |
| 2 | **Dashboard** | `/` | Afiliado | Mock |
| 3 | **Links** | `/links` | Afiliado | Mock |
| 4 | **Produtos** | `/products`, `/admin/products` | Afiliado + Admin | Mock (localStorage) |
| 5 | **Vendas / Assinaturas** | `/sales`, `/admin/sales` | Afiliado + Admin | Mock (in-memory) |
| 6 | **Financeiro Afiliado** | `/finance` | Afiliado | Mock (localStorage) — PII em risco |
| 7 | **Financeiro Admin** | `/admin/finance` | Admin | Mock (in-memory) |
| 8 | **Rede** | `/network`, `/admin/network` | Afiliado + Admin | Mock (in-memory) |
| 9 | **Promoções** | `/promotions` | Admin | Mock (in-memory) |
| 10 | **Tutoriais** | `/tutorials`, `/admin/tutorials` | Afiliado + Admin | Mock (localStorage) |
| 11 | **Notícias** | `/admin/news` | Admin | Mock (localStorage) |
| 12 | **Relatórios** | `/admin/reports` | Admin | Mock (in-memory) |
| 13 | **WhatsApp Admin** | `/admin/whatsapp` | Admin | Mock (localStorage) — token em risco |
| 14 | **Rastreamento Referral** | `/join/:code`, `/r/:userId/:slug` | Público | Parcial (cookie + LS, sem server-side) |
| 15 | **Perfil / Conta** | `/account` | Afiliado | Real (Supabase profiles) |
| 16 | **i18n / Currency** | Global | Transversal | Client-side (LS) |
| 17 | **Smart Alerts** | Global (bell + contextual) | Transversal | Mock (funções puras) |

---

## Banco de Dados — Migrations Identificadas

| Migration | Conteúdo |
|-----------|---------|
| `20260421201903` | Tabela `profiles`, índices, RLS, `generate_affiliate_code()`, `handle_new_user()` trigger |
| `20260421201938` | Patch: `profiles_prevent_immutable_changes()` e `generate_affiliate_code()` com `SECURITY DEFINER` |

**Tabelas reais no banco:** apenas `profiles` (+ `auth.users` via Supabase Auth)

---

## Cobertura de Testes

- Arquivos de teste encontrados: **0**
- Framework de teste: não configurado
