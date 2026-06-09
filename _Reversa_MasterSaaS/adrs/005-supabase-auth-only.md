# ADR-005 — Supabase usado apenas para Auth + profiles
**Status:** Ativo (transitório) 🟢  
**Data:** 2026-04-21 (commit `0c089d1` — "Habilitou Cloud e ref-tracking")  
**Confiança:** 🟢 CONFIRMADO

## Contexto
O Lovable usa Supabase como BaaS. A decisão foi integrar apenas Auth + profiles inicialmente, deixando todo o restante como mock enquanto a arquitetura backend era definida.

## Decisão
Integrar Supabase para:
- Auth (email/senha, OTP, Google OAuth via Lovable wrapper)
- Tabela `profiles` com `affiliate_code`, `referred_by_id`
- Triggers `handle_new_user`, `profiles_prevent_immutable_changes`
- Função `generate_affiliate_code()`

Todo o restante permanece em mock/localStorage.

## Alternativas consideradas
- Supabase completo desde o início: correto tecnicamente, mas bloquearia iteração rápida de UI
- Backend próprio (Fastify): planejado para a fase de implementação real

## Consequências
- Auth funciona em produção para usuários reais
- Todo o restante é simulação — não escala para múltiplos usuários simultâneos
- `types.ts` do Supabase reflete apenas `profiles` — precisa ser regenerado após migrações
- O Fastify backend (Matrix monorepo) é o destino final — não ampliar o Supabase além do necessário para Auth
