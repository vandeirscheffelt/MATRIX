-- =============================================================================
-- Fase 7 — Gênero do assistente + flag de prompt atualizado
-- genero_assistente: masculino / feminino / neutro (para seleção de pronomes)
-- prompt_atualizado: false quando config muda, true após regeneração do prompt
-- =============================================================================

ALTER TABLE "atendente_ia"."config_bot"
  ADD COLUMN IF NOT EXISTS "genero_assistente" TEXT NOT NULL DEFAULT 'neutro',
  ADD COLUMN IF NOT EXISTS "prompt_atualizado"  BOOLEAN NOT NULL DEFAULT true;
