-- =============================================================================
-- Fase 1 — Shaikron Backend
-- Aplicar no Supabase SQL Editor
-- =============================================================================

-- 1. Enum origem_mensagem
CREATE TYPE "atendente_ia"."origem_mensagem_enum" AS ENUM ('LEAD', 'BOT', 'HUMANO');

-- 2. Tabela servicos
CREATE TABLE "atendente_ia"."servicos" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "empresa_id"  UUID NOT NULL REFERENCES "atendente_ia"."empresas"("id") ON DELETE CASCADE,
  "nome"        TEXT NOT NULL,
  "duracao_min" INTEGER NOT NULL DEFAULT 60,
  "ordem"       INTEGER NOT NULL DEFAULT 0,
  "ativo"       BOOLEAN NOT NULL DEFAULT true,
  "criado_em"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabela profissional_servicos (M:N)
CREATE TABLE "atendente_ia"."profissional_servicos" (
  "profissional_id" UUID NOT NULL REFERENCES "atendente_ia"."profissionais"("id") ON DELETE CASCADE,
  "servico_id"      UUID NOT NULL REFERENCES "atendente_ia"."servicos"("id") ON DELETE CASCADE,
  PRIMARY KEY ("profissional_id", "servico_id")
);

-- 4. Tabela mensagens_conversa
CREATE TABLE "atendente_ia"."mensagens_conversa" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversa_id" UUID NOT NULL REFERENCES "atendente_ia"."conversas"("id") ON DELETE CASCADE,
  "origem"      "atendente_ia"."origem_mensagem_enum" NOT NULL,
  "conteudo"    TEXT NOT NULL,
  "criado_em"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "mensagens_conversa_conversa_id_criado_em_idx"
  ON "atendente_ia"."mensagens_conversa"("conversa_id", "criado_em");

-- 5. Novos campos em conversas
ALTER TABLE "atendente_ia"."conversas"
  ADD COLUMN IF NOT EXISTS "arquivada"        BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "resolvida_em"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "ultima_mensagem"  TEXT,
  ADD COLUMN IF NOT EXISTS "ultima_atividade" TIMESTAMPTZ;

-- 6. Novos campos em config_bot
ALTER TABLE "atendente_ia"."config_bot"
  ADD COLUMN IF NOT EXISTS "idioma"               TEXT NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS "tipo_negocio"         TEXT,
  ADD COLUMN IF NOT EXISTS "contexto_operacional" TEXT,
  ADD COLUMN IF NOT EXISTS "identidade"           TEXT NOT NULL DEFAULT 'assistente_virtual',
  ADD COLUMN IF NOT EXISTS "disponibilidade"      TEXT NOT NULL DEFAULT 'horario_comercial',
  ADD COLUMN IF NOT EXISTS "horario_inicio"       TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS "horario_fim"          TEXT NOT NULL DEFAULT '18:00';
