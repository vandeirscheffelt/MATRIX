# ADR-003 — localStorage como backend temporário
**Status:** Ativo (temporário) 🟡  
**Data:** 2026-04-19 (commit `60f5acf`)  
**Confiança:** 🟢 CONFIRMADO

## Contexto
O desenvolvimento foi feito no Lovable (prototipagem rápida). Backend real seria construído posteriormente pela equipe de engenharia.

## Decisão
Usar `localStorage` + stores in-memory como persistência temporária para:
- Produtos (`localStorage("products")`)
- Tutoriais (`localStorage("mastersaas:tutorials:v1")`)
- News (`localStorage`)
- Saques (`localStorage("affiliate_withdrawals")`)
- Dados bancários (`localStorage("affiliate_payment_details")`) ← 🔴 CRÍTICO

## Alternativas consideradas
- Backend imediato: mais correto mas torna prototipagem muito lenta
- BaaS (Supabase): adotado apenas para Auth + profiles por ser crítico

## Consequências
- PII financeira (CPF, dados bancários) em texto puro no localStorage — risco grave de segurança
- Estado perde-se ao limpar browser ou trocar dispositivo
- SSR retorna snapshot estático (`mockProducts`) em vez de dados reais
- **Migração obrigatória antes de qualquer usuário real**
