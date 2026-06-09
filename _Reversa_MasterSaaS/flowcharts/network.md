# Flowchart — Módulo Rede (Network)
> Arqueólogo (Reversa v1.2.14) — 2026-06-08

---

## Fluxo: resolveNetworkRules

```mermaid
flowchart TD
    A[resolveNetworkRules(now)] --> B[Carrega base: defaultRatePct, eligibilityDays, minSalesRequired]
    B --> C[getActiveNetworkCampaign(now)]
    C --> D{Campanha ativa?}
    D -->|Não| E[Retorna regras base]
    D -->|Sim| F[Override: ratePct = camp.ratePctOverride ?? base.ratePct]
    F --> G[Override: eligibilityDays = camp.eligibilityDaysOverride ?? base.eligibilityDays]
    G --> H[Override: minSales = camp.minSalesOverride ?? base.minSales]
    H --> I[Retorna regras com fromCampaign]
```

---

## Fluxo: isReferralEligible

```mermaid
flowchart TD
    A[isReferralEligible(lastSaleAt, rules, recentSalesCount)] --> B{lastSaleAt é null?}
    B -->|Sim| C[Retorna false]
    B -->|Não| D{recentSalesCount < rules.minSales?}
    D -->|Sim| C
    D -->|Não| E[Calcula dias desde lastSaleAt]
    E --> F{dias > rules.eligibilityDays?}
    F -->|Sim| C
    F -->|Não| G[Retorna true]
```

---

## Fluxo: Comissão de rede (NECESSÁRIO — não implementado)

```mermaid
flowchart TD
    A[Venda confirmada] --> B[Afiliado tem referred_by_id?]
    B -->|Não| C[Fim]
    B -->|Sim| D[Carregar referrer profile]
    D --> E[isReferralEligible(referrer)]
    E -->|Não elegível| C
    E -->|Elegível| F[resolveNetworkRules()]
    F --> G[Calcular comissão: venda.commission * rules.ratePct / 100]
    G --> H[INSERT referral_commissions]
    H --> I[Notificar referrer via n8n]
```
