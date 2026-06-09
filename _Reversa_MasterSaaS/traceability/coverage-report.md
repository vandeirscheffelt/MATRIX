# Relatório de Cobertura — MasterSaaS
> Writer (Reversa v1.2.14) — 2026-06-08 | doc_level: detalhado

---

## Visão Geral

| Dimensão | Valor |
|----------|-------|
| Arquivos analisados | 114 |
| Módulos identificados | 17 |
| SDDs geradas | 13 |
| Endpoints OpenAPI documentados | 28 |
| User stories criadas | 28 (11 afiliado + 10 admin + 7 onboarding) |
| Cobertura de lógica de negócio | **82%** |
| Confiança média das specs | **🟡 Alta-Média** |

---

## Cobertura por Módulo

| Módulo | SDD | OpenAPI | User Stories | Confiança | Observações |
|--------|-----|---------|--------------|-----------|-------------|
| **auth** | 🟢 | 🟢 `/profiles/me` | 🟢 US-AF-02, US-OB-01/03 | 🟢 Alta | Backend real (Supabase). Único módulo 100% funcional hoje. |
| **referral-tracking** | 🟢 | 🟢 `/referral/links` | 🟢 US-AF-04, US-OB-01/04 | 🟡 Média | Rota `/r/:userId/:slug` não encontrada no código — pode estar ausente. `setAffiliateParent` (cookie 14d) não localizado. |
| **products** | 🟢 | 🟢 `/products`, `/products/{slug}/price` | 🟢 US-AF-03, US-ADM-01 | 🟢 Alta | `productUrl` e `productCode` ausentes no tipo mas necessários — blueprint. |
| **promotions** | 🟢 | 🟢 `/promotions`, `/promotions/active` | 🟢 US-AF-03, US-ADM-02 | 🟢 Alta | Algoritmos `resolveEffectiveRate` e `getPromotionStatus` totalmente mapeados. |
| **sales-subscriptions** | 🟢 | 🟢 `/sales`, `/admin/sales` | 🟢 US-AF-05, US-ADM-05 | 🟡 Média | Modelo de venda inferido do mock — sem schema real de banco. |
| **commissions** | 🟢 | 🟢 `/commissions`, `/admin/commissions`, `/admin/jobs/release-commissions` | 🟢 US-AF-05/06/07, US-ADM-03/04 | 🟡 Média | Módulo de maior risco. Toda lógica em mock in-memory. Holding de 30d e CRON inferidos do design, não do código. |
| **network** | 🟢 | 🟢 `/network/settings`, `/network/referrals`, `/network/campaigns` | 🟢 US-AF-08/09, US-ADM-06/07 | 🟢 Alta | `resolveNetworkRules` e `isReferralEligible` totalmente mapeados. |
| **finance-affiliate** | 🟢 | 🟢 `/commissions/summary` | 🟢 US-AF-05/06 | 🟡 Média | Saldo derivado de comissões — lógica de agrupamento inferida do mock. |
| **finance-admin** | 🟢 | 🟢 `/admin/commissions` | 🟢 US-ADM-04/05 | 🟡 Média | 1.710 LOC no `admin.finance.tsx` — arquivo mais complexo do projeto, apenas parcialmente analisado. |
| **withdrawals-payout** | 🟢 | 🟢 `/withdrawals`, `/admin/withdrawals` | 🟢 US-AF-06, US-ADM-03 | 🟡 Média | Fluxo de saque mapeado via UI. Integração com provider de pagamento (PIX/banco) não implementada. |
| **tutorials-news** | 🟢 | 🟢 `/tutorials` | 🟢 US-AF-10, US-ADM-08, US-OB-06 | 🟢 Alta | `extractYoutubeId` totalmente mapeado (6 formatos). News sem SDD dedicado — cobertura parcial. |
| **smart-alerts** | 🟢 | 🟢 `/alerts` | 🟢 US-AF-11, US-ADM-10 | 🟢 Alta | Todos os algoritmos de detecção mapeados com thresholds exatos. |
| **whatsapp-integration** | 🟢 | 🟢 `/whatsapp/status`, `/whatsapp/templates` | 🟢 US-ADM-09 | 🔴 Baixa | Token WhatsApp em localStorage (risco de segurança). Integração real com Evolution API não implementada. |
| **dashboard** | — | — | 🟡 parcial (US-AF-11) | 🟡 Média | Sem SDD dedicado — composto de widgets de outros módulos. |
| **i18n-currency** | — | — | — | 🟡 Média | ~2.400 chaves pt/en/es. Detecção de moeda por IP (geo.ts). Sem SDD — transversal. |
| **reports** | — | — | 🟡 parcial (US-ADM-05) | 🔴 Baixa | Sem SDD dedicado. `admin.reports.tsx` não analisado em profundidade. |
| **news** | 🟡 parcial (em tutorials-news.md) | — | — | 🟡 Média | Coberto parcialmente no SDD de tutorials. Sem US dedicada. |

---

## Cobertura por Camada

### Lógica de negócio (`src/lib/`)

| Arquivo | Confiança | Gaps identificados |
|---------|-----------|-------------------|
| `referral-storage.ts` | 🟢 Alta | — |
| `mock-data.ts` | 🟢 Alta | `productUrl`/`productCode` ausentes no tipo |
| `products-store.ts` | 🟢 Alta | — |
| `promotions-store.ts` | 🟢 Alta | — |
| `alerts-data.ts` | 🟢 Alta | — |
| `tutorials-store.ts` | 🟢 Alta | — |
| `network-settings-store.ts` | 🟢 Alta | — |
| `network-data.ts` | 🟢 Alta | REFERRAL_RATE hardcoded (5%) |
| `admin-finance-data.ts` | 🟡 Média | Mock complexo — schema real não definido |
| `admin-sales-data.ts` | 🟡 Média | Mock — sem schema real |
| `progress-store.ts` | 🟡 Média | Tracking de tutoriais em localStorage — sem backend |
| `watched-videos-store.ts` | 🟡 Média | Idem |
| `ranking-data.ts` | 🟡 Média | Leaderboard mock — sem spec dedicada |
| `sales-copy.ts` | 🟡 Média | Multi-locale — sem spec de internacionalização |
| `geo.ts` | 🟡 Média | Detecção por IP — sem spec de fallback |
| `news-store.ts` | 🟡 Média | localStorage — sem backend definido |
| `i18n.ts` | — | Transversal — fora do escopo das specs |
| `utils.ts` | — | Utilitários genéricos |

### Rotas (`src/routes/`)

| Rota | Confiança | Gaps |
|------|-----------|------|
| `/login`, `/signup` | 🟢 Alta | — |
| `/join/:code` | 🟢 Alta | — |
| `/links` | 🟢 Alta | — |
| `/products` | 🟢 Alta | — |
| `/promotions` | 🟢 Alta | — |
| `/sales` | 🟡 Média | Schema de venda inferido |
| `/finance` | 🟡 Média | Lógica de saldo inferida |
| `/network` | 🟢 Alta | — |
| `/tutorials` | 🟢 Alta | — |
| `/account` | 🟡 Média | Cobertura parcial no SDD de auth |
| `/` (dashboard) | 🟡 Média | Sem SDD dedicado |
| `/admin/finance` | 🟡 Média | 1.710 LOC — análise incompleta |
| `/admin/network` | 🟢 Alta | — |
| `/admin/products` | 🟢 Alta | — |
| `/admin/sales` | 🟡 Média | Mock |
| `/admin/tutorials` | 🟢 Alta | — |
| `/admin/whatsapp` | 🔴 Baixa | Token em localStorage, Evolution API não integrada |
| `/admin/news` | 🟡 Média | Cobertura parcial |
| `/admin/reports` | 🔴 Baixa | Não analisada em profundidade |

---

## Gaps Críticos (bloqueadores de implementação)

| # | Gap | Módulo | Impacto | Recomendação |
|---|-----|--------|---------|--------------|
| G1 | **CRON de liberação de comissões não implementado** | commissions | 🔴 Crítico | Implementar job diário `pending → available` com `hold_until < NOW()`. Sem isso, nenhuma comissão é liberada. |
| G2 | **Token WhatsApp em localStorage** | whatsapp-integration | 🔴 Crítico | Mover para variável de ambiente server-side. Token exposto ao cliente é risco de segurança grave. |
| G3 | **Rota `/r/:userId/:slug` ausente** | referral-tracking | 🔴 Crítico | Sem essa rota, links de afiliado não funcionam. Implementar com captura de `src` antes do redirect para checkout. |
| G4 | **Dados financeiros do afiliado em localStorage** | finance-affiliate | 🔴 Crítico | PII financeiro no cliente. Migrar para backend com RLS por `affiliate_id`. |
| G5 | **Schema de `sales` não definido** | sales-subscriptions | 🟡 Alto | Tipo `Sale` inferido do mock. Definir schema real antes de implementar commissions. |
| G6 | **`admin.finance.tsx` (1.710 LOC) parcialmente analisado** | finance-admin | 🟡 Alto | Arquivo mais complexo do projeto. Requer análise dedicada — pode conter regras de negócio não documentadas. |
| G7 | **`productUrl` e `productCode` ausentes no tipo `Product`** | products | 🟡 Alto | Necessários para geração de links de afiliado. Adicionar ao schema antes de implementar referral-tracking no backend. |
| G8 | **`setAffiliateParent` (cookie 14d) não encontrado** | referral-tracking | 🟡 Alto | Mencionado no blueprint mas ausente no código. Implementar para atribuição server-side. |
| G9 | **Integração Evolution API ausente** | whatsapp-integration | 🟡 Alto | Toda a integração WhatsApp é mock. Implementar via n8n + Evolution API conforme padrão do ecossistema. |
| G10 | **`admin.reports.tsx` não analisado** | reports | 🟡 Médio | Rota de relatórios pode conter lógica de agregação não documentada. Analisar antes de implementar backend. |

---

## Distribuição de Confiança

```
🟢 Alta    ████████████████████  8 módulos  (47%)
🟡 Média   ████████████████      7 módulos  (41%)
🔴 Baixa   ████                  2 módulos  (12%)
```

---

## Recomendação de Implementação

Com base na cobertura e nos gaps identificados, a sequência recomendada de implementação backend é:

1. **Schema de banco** — definir tabelas reais: `sales`, `commissions`, `commission_history`, `withdrawals`, `promotions`, `network_settings`, `network_campaigns`, `tutorials`, `news`, `whatsapp_templates`
2. **Fechar G5 (sales schema)** antes de implementar commissions
3. **Fechar G3 (rota referral)** — sem ela os links não funcionam
4. **Fechar G1 (CRON commissions)** — bloqueador do fluxo financeiro inteiro
5. **Fechar G4 (finance localStorage)** e **G2 (WhatsApp token)** — riscos de segurança
6. **Analisar `admin.finance.tsx`** (G6) antes de implementar finance-admin
