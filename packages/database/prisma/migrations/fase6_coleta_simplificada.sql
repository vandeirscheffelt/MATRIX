-- =============================================================================
-- Fase 6 — Remove campos de coleta desnecessários
-- Endereço e LGPD removidos: sem coleta de dados sensíveis, LGPD não se aplica
-- =============================================================================

ALTER TABLE "atendente_ia"."config_bot"
  DROP COLUMN IF EXISTS "coletar_endereco",
  DROP COLUMN IF EXISTS "lgpd_ativo",
  DROP COLUMN IF EXISTS "lgpd_texto";
