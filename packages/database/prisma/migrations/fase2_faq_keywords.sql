-- =============================================================================
-- Fase 2 — FAQ como tabela + Keywords
-- Aplicar no Supabase SQL Editor
-- =============================================================================

-- 1. FAQ entries (substitui o JSON de config_bot.faq)
CREATE TABLE "atendente_ia"."faq_entries" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "empresa_id" UUID NOT NULL REFERENCES "atendente_ia"."empresas"("id") ON DELETE CASCADE,
  "pergunta"   TEXT NOT NULL,
  "resposta"   TEXT NOT NULL,
  "origem"     TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'sugestao_ia'
  "criado_em"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "faq_entries_empresa_id_idx" ON "atendente_ia"."faq_entries"("empresa_id");

-- 2. FAQ sugestões geradas pela IA
CREATE TABLE "atendente_ia"."faq_sugestoes" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "empresa_id"          UUID NOT NULL REFERENCES "atendente_ia"."empresas"("id") ON DELETE CASCADE,
  "pergunta"            TEXT NOT NULL,
  "resposta_sugerida"   TEXT NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'pendente', -- 'pendente' | 'aprovada' | 'rejeitada'
  "origem_conversa_id"  UUID REFERENCES "atendente_ia"."conversas"("id") ON DELETE SET NULL,
  "criado_em"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "faq_sugestoes_empresa_id_status_idx" ON "atendente_ia"."faq_sugestoes"("empresa_id", "status");

-- 3. Keywords por empresa
CREATE TABLE "atendente_ia"."keywords" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "empresa_id" UUID NOT NULL REFERENCES "atendente_ia"."empresas"("id") ON DELETE CASCADE,
  "palavra"    TEXT NOT NULL,
  "origem"     TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'sugestao_ia'
  "criado_em"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("empresa_id", "palavra")
);
