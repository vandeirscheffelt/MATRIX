# ADR-004 — Status de comissão: Approved renomeado para Processing
**Status:** Ativo 🟢  
**Data:** 2026-04-20 (commit `3284e19`)  
**Confiança:** 🟢 CONFIRMADO

## Contexto
O status intermediário entre "liberado para saque" e "pago" estava nomeado `approved`, o que criava ambiguidade — "aprovado" pode significar "liberado do holding" ou "aprovado pelo admin para pagamento".

## Decisão
Renomear `approved` → `processing` para refletir que o status indica que o pagamento está em andamento (não apenas aprovado para ser pago).

## Alternativas consideradas
- Manter `approved`: mais simples, mas ambíguo
- Usar `in_flight`: mais técnico, menos claro para usuários

## Consequências
- Frontend usa: `pending | processing | paid | partially_paid | reversed`
- Backend (blueprint) usa: `pending | available | processing | paid | canceled | failed | refunded`
- **Divergência**: `available` do blueprint não tem equivalente claro no frontend — backend deve implementar o schema completo do blueprint
- `partially_paid` no frontend não tem equivalente no blueprint — clarificar com produto
