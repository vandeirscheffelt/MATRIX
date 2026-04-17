-- =============================================================================
-- Fase 4 — Admin interno
-- Aplicar no Supabase SQL Editor
-- =============================================================================

-- 1. Adicionar roles ADMIN_GLOBAL e ACCOUNT_OWNER ao enum existente
ALTER TYPE "atendente_ia"."role_usuario_enum" ADD VALUE IF NOT EXISTS 'ADMIN_GLOBAL';
ALTER TYPE "atendente_ia"."role_usuario_enum" ADD VALUE IF NOT EXISTS 'ACCOUNT_OWNER';

-- 2. Versões de preço
CREATE TABLE "atendente_ia"."pricing_versions" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome"       TEXT NOT NULL,
  "descricao"  TEXT,
  "ativa"      BOOLEAN NOT NULL DEFAULT false,
  "payload"    JSONB NOT NULL DEFAULT '{}', -- preços e limites desta versão
  "criado_em"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "ativado_em" TIMESTAMPTZ
);

-- 3. Produtos externos
CREATE TABLE "atendente_ia"."external_products" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome"       TEXT NOT NULL,
  "descricao"  TEXT,
  "url"        TEXT,
  "ativo"      BOOLEAN NOT NULL DEFAULT true,
  "ordem"      INTEGER NOT NULL DEFAULT 0,
  "criado_em"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Módulos internos
CREATE TABLE "atendente_ia"."internal_modules" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "nome"       TEXT NOT NULL,
  "descricao"  TEXT,
  "chave"      TEXT NOT NULL UNIQUE, -- slug identificador (ex: 'agenda', 'whatsapp', 'billing')
  "ativo"      BOOLEAN NOT NULL DEFAULT true,
  "criado_em"  TIMESTAMPTZ NOT NULL DEFAULT now()
);
