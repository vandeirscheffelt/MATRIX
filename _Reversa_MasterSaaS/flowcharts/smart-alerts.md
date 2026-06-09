# Flowchart — Smart Alerts
> Arqueólogo (Reversa v1.2.14) — 2026-06-08

---

## Fluxo: generateAlerts()

```mermaid
flowchart TD
    A[generateAlerts()] --> B[Filtra sales com status=completed]
    B --> C{completed vazio?}
    C -->|Sim| D[Retorna array vazio]
    C -->|Não| E[Ordena datas, calcula midDate]
    E --> F[Separa recent vs prior pelo midDate]
    F --> G[Calcula recentRev e priorRev]

    G --> H{priorRev > 0?}
    H -->|Sim| I{delta >= 15%?}
    I -->|Sim| J[ADD: alert-sales-spike success]
    I -->|Não| K{delta <= -15%?}
    K -->|Sim| L[ADD: alert-conversion-drop danger]

    G --> M[Agrupa vendas recentes por afiliado]
    M --> N{topAff.share >= 25%?}
    N -->|Sim| O[ADD: alert-top-affiliate info]

    G --> P[Para cada promoção ativa]
    P --> Q{daysRemaining <= 3?}
    Q -->|Sim| R[ADD: alert-campaign-ending warning]
    P --> S{campaignSales.length >= 3?}
    S -->|Sim| T[ADD: alert-campaign-strong success]
    P --> U{status === Upcoming?}
    U -->|Sim| V[ADD: alert-campaign-upcoming info]

    G --> W{availableBalance >= 100?}
    W -->|Sim| X[ADD: alert-payout-available success]
    G --> Y{pendingBalance > 0?}
    Y -->|Sim| Z[ADD: alert-payout-pending info]
    G --> AA{pendingAffs > 0?}
    AA -->|Sim| AB[ADD: alert-pending-approvals warning]

    AB --> AC[Ordena: danger→warning→success→info, depois por data desc]
    AC --> AD[Retorna alerts]
```
