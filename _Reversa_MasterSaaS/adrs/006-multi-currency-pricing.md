# ADR-006 — Multi-currency pricing por mapa, não campo único
**Status:** Ativo 🟢  
**Data:** 2026-04-19 (commit `7525994`) + 2026-04-20 (commit `8c2ef2b`)  
**Confiança:** 🟢 CONFIRMADO

## Contexto
Produtos são vendidos para LATAM (BRL, MXN) e mercado internacional (USD, EUR). Um preço único seria inadequado.

## Decisão
Cada produto tem um mapa `prices: Partial<Record<CurrencyCode, number>>`. A resolução segue a ordem:
1. Moeda preferida do usuário (URL > localStorage > geo-IP)
2. `fallbackCurrency` do produto
3. "BRL" (hardcoded como último fallback)

Campos `price` e `currency` marcados como `@deprecated` no tipo `Product`.
Moedas duplicadas bloqueadas por produto (commit `b88e82e`).

## Alternativas consideradas
- Conversão automática via FX: mais flexível, mas `getFxRateFromBRL()` atual é estático — risco de valores desatualizados
- Preço único em USD: mais simples, mas experiência ruim para BRL/MXN

## Consequências
- Cada produto precisa de preço cadastrado por moeda — admin faz esse trabalho
- `getFxRateFromBRL()` estático é um débito técnico — necessita fonte real (ECB API ou cache diário)
- SSR pode ter flash de moeda incorreta (bug corrigido em `860811f` para i18n, mas pode reaparecer para currency)
