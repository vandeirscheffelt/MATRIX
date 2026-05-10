-- =============================================================================
-- Fase 5 — Simplificação coleta de dados: 4 perfis → toggle único
-- Aplicar no Supabase SQL Editor ou via prisma db execute
-- =============================================================================

-- Remove campo legado de perfil de coleta (4 valores enum: BASICO/PADRAO/COMPLETO/CLINICO)
ALTER TABLE "atendente_ia"."config_bot"
  DROP COLUMN IF EXISTS "perfil_coleta";

-- Adiciona toggle único: OFF = Nome+Telefone, ON = campos CRM completos por tipo de negócio
ALTER TABLE "atendente_ia"."config_bot"
  ADD COLUMN IF NOT EXISTS "coletar_cadastro_completo" BOOLEAN NOT NULL DEFAULT false;
