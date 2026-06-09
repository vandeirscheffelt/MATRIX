# Flowchart — Módulo Promoções
> Arqueólogo (Reversa v1.2.14) — 2026-06-08

---

## Fluxo: resolveEffectiveRate (CRÍTICO para cálculo de comissão)

```mermaid
flowchart TD
    A[resolveEffectiveRate(promo, affiliateSalesInCampaign)] --> B{performanceEnabled?}
    B -->|Sim| C{affiliateSales >= performanceMinSales?}
    C -->|Sim| D[Retorna performanceRateIfReached]
    C -->|Não| E[Retorna performanceRateIfNotReached]
    B -->|Não| F[Retorna commissionRateOverride]
```

---

## Fluxo: getPromotionStatus

```mermaid
flowchart TD
    A[getPromotionStatus(p, now)] --> B{p.enabled?}
    B -->|Não| C[Retorna 'Disabled']
    B -->|Sim| D[parse startDate + endDate]
    D --> E[end.setHours(23,59,59,999)]
    E --> F{now < start?}
    F -->|Sim| G[Retorna 'Upcoming']
    F -->|Não| H{now > end?}
    H -->|Sim| I[Retorna 'Expired']
    H -->|Não| J[Retorna 'Active']
```

---

## Fluxo: resolvePromoDurationMonths

```mermaid
flowchart TD
    A[resolvePromoDurationMonths(p)] --> B{durationOverride definido?}
    B -->|Não| C[Retorna undefined]
    B -->|Sim| D{=== 'Lifetime'?}
    D -->|Sim| E[Retorna null]
    D -->|Não| F{=== 'Custom'?}
    F -->|Sim| G[Retorna customDurationMonths ?? null]
    F -->|Não| H[parseInt(durationOverride, 10)]
```

---

## Fluxo: getActivePromotionForProduct

```mermaid
flowchart TD
    A[getActivePromotionForProduct(slug, now)] --> B[Filtra promotions por productSlug === slug]
    B --> C[Para cada uma: getPromotionStatus(p, now)]
    C --> D{status === 'Active'?}
    D -->|Sim| E[Retorna primeira encontrada]
    D -->|Não| F[Continua]
    F --> G[Retorna undefined]
```
