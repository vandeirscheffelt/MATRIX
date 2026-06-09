# ADR-002 — Promoções são operação exclusiva de Admin
**Status:** Ativo 🟢  
**Data:** 2026-04-21 (commit `38edd8f`)  
**Confiança:** 🟢 CONFIRMADO

## Contexto
Inicialmente, promoções estavam acessíveis como self-service do afiliado. Isso gerava risco de afiliados criando promoções não autorizadas ou conflitantes.

## Decisão
Mover o CRUD de promoções para o grupo Admin da sidebar. Afiliados continuam vendo promoções ativas, mas não podem criar ou editar.

## Alternativas consideradas
- **Self-service com aprovação**: afiliado cria, admin aprova — mais flexível mas adiciona workflow
- **Manter como afiliado**: cria riscos operacionais e de margem

## Consequências
- Admin tem controle total sobre campanhas e taxas de comissão
- Afiliados não podem negociar promoções diretamente
- Sidebar admin sempre visível para todos (🔴 gap de segurança a corrigir com RBAC)
