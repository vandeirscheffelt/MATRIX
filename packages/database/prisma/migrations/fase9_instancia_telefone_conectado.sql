-- Adiciona telefone_conectado na instancia para validar conflito com gerente
ALTER TABLE atendente_ia.instancias_whatsapp
  ADD COLUMN IF NOT EXISTS telefone_conectado TEXT;
