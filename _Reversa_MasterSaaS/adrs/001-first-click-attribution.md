# ADR-001 — Atribuição First-Click
**Status:** Ativo 🟢  
**Data:** ~2026-04-19 (inferido dos commits)  
**Confiança:** 🟢 CONFIRMADO

## Contexto
O sistema precisa atribuir uma venda a exatamente um afiliado quando múltiplos podem ter gerado tráfego para o mesmo cliente.

## Decisão
Adotar **first-click wins**: o primeiro afiliado que gerou o clique fica permanentemente atribuído. Nenhum clique subsequente sobrescreve.

Implementação:
- `setRefCode` em `referral-storage.ts` não sobrescreve valor existente no localStorage
- `referred_by_id` em `profiles` é imutável após set (trigger banco)

## Alternativas consideradas
- **Last-click**: mais comum em adtech, mas favorece afiliados que aparecem no final do funil (retargeting)
- **Linear attribution**: distribui crédito entre todos os afiliados — muito complexo para o modelo atual

## Consequências
- Afiliados de topo de funil são valorizados (justa para quem apresenta o produto primeiro)
- Risco: usuário que limpa cookies perde atribuição silenciosamente
- Mitigação necessária: validação server-side via fingerprint/sessão no momento da conversão (🔴 não implementado)
