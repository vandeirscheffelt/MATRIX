-- ============================================================
-- Schema: expenses
-- App: apps/expense-tracker/
-- Criado em: 2026-04-03
-- ============================================================

CREATE SCHEMA IF NOT EXISTS expenses;

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------

CREATE TYPE expenses.forma_pagamento AS ENUM ('boleto', 'cartao');
CREATE TYPE expenses.status_pagamento AS ENUM ('pendente', 'pago');

-- ------------------------------------------------------------
-- expenses.contas
-- Template de contas recorrentes mensais
-- ------------------------------------------------------------

CREATE TABLE expenses.contas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(100) NOT NULL,
  categoria     VARCHAR(50)  NOT NULL,
  forma_pgto    expenses.forma_pagamento NOT NULL,
  dia_vencimento SMALLINT NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  ativa         BOOLEAN NOT NULL DEFAULT TRUE,
  criada_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contas_ativa ON expenses.contas(ativa);
CREATE INDEX idx_contas_categoria ON expenses.contas(categoria);

-- ------------------------------------------------------------
-- expenses.pagamentos
-- Instância mensal de cada conta (gerada automaticamente)
-- ------------------------------------------------------------

CREATE TABLE expenses.pagamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id        UUID NOT NULL REFERENCES expenses.contas(id) ON DELETE CASCADE,
  mes_referencia  DATE NOT NULL, -- sempre primeiro dia do mês: 2026-04-01
  valor_pago      DECIMAL(10, 2) CHECK (valor_pago >= 0),
  status          expenses.status_pagamento NOT NULL DEFAULT 'pendente',
  pago_em         TIMESTAMPTZ,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (conta_id, mes_referencia) -- uma instância por conta por mês
);

CREATE INDEX idx_pagamentos_conta_id   ON expenses.pagamentos(conta_id);
CREATE INDEX idx_pagamentos_mes        ON expenses.pagamentos(mes_referencia);
CREATE INDEX idx_pagamentos_status     ON expenses.pagamentos(status);
CREATE INDEX idx_pagamentos_mes_status ON expenses.pagamentos(mes_referencia, status);

-- ------------------------------------------------------------
-- expenses.parcelamentos
-- Compras parceladas no cartão de crédito
-- ------------------------------------------------------------

CREATE TABLE expenses.parcelamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           VARCHAR(100) NOT NULL,
  valor_total    DECIMAL(10, 2) NOT NULL CHECK (valor_total > 0),
  num_parcelas   SMALLINT NOT NULL CHECK (num_parcelas > 0),
  valor_parcela  DECIMAL(10, 2) NOT NULL CHECK (valor_parcela > 0), -- calculado, mas editável
  mes_inicio     DATE NOT NULL, -- primeiro dia do mês inicial
  cartao         VARCHAR(50),
  ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parcelamentos_ativo    ON expenses.parcelamentos(ativo);
CREATE INDEX idx_parcelamentos_mes_ini  ON expenses.parcelamentos(mes_inicio);

-- ------------------------------------------------------------
-- expenses.parc_mensais
-- Parcela individual de cada mês
-- ------------------------------------------------------------

CREATE TABLE expenses.parc_mensais (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcelamento_id   UUID NOT NULL REFERENCES expenses.parcelamentos(id) ON DELETE CASCADE,
  mes_referencia    DATE NOT NULL,
  numero_parcela    SMALLINT NOT NULL CHECK (numero_parcela > 0),
  valor_parcela     DECIMAL(10, 2) NOT NULL CHECK (valor_parcela > 0),
  status            expenses.status_pagamento NOT NULL DEFAULT 'pendente',
  pago_em           TIMESTAMPTZ,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (parcelamento_id, mes_referencia)
);

CREATE INDEX idx_parc_mensais_parcelamento ON expenses.parc_mensais(parcelamento_id);
CREATE INDEX idx_parc_mensais_mes          ON expenses.parc_mensais(mes_referencia);
CREATE INDEX idx_parc_mensais_mes_status   ON expenses.parc_mensais(mes_referencia, status);

-- ------------------------------------------------------------
-- TRIGGERS: atualiza atualizada_em automaticamente
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION expenses.set_atualizada_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Alias para tabelas que usam "atualizada_em"
CREATE OR REPLACE FUNCTION expenses.set_atualizada_em_contas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizada_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_contas_updated
  BEFORE UPDATE ON expenses.contas
  FOR EACH ROW EXECUTE FUNCTION expenses.set_atualizada_em_contas();

CREATE TRIGGER trg_pagamentos_updated
  BEFORE UPDATE ON expenses.pagamentos
  FOR EACH ROW EXECUTE FUNCTION expenses.set_atualizada_em();

CREATE TRIGGER trg_parcelamentos_updated
  BEFORE UPDATE ON expenses.parcelamentos
  FOR EACH ROW EXECUTE FUNCTION expenses.set_atualizada_em();

CREATE TRIGGER trg_parc_mensais_updated
  BEFORE UPDATE ON expenses.parc_mensais
  FOR EACH ROW EXECUTE FUNCTION expenses.set_atualizada_em();

-- ------------------------------------------------------------
-- VIEW: resumo do mês atual
-- Útil para a tela principal
-- ------------------------------------------------------------

CREATE OR REPLACE VIEW expenses.v_resumo_mes AS
SELECT
  p.mes_referencia,
  c.categoria,
  COUNT(*) FILTER (WHERE p.status = 'pago')     AS qtd_pagas,
  COUNT(*) FILTER (WHERE p.status = 'pendente') AS qtd_pendentes,
  SUM(p.valor_pago) FILTER (WHERE p.status = 'pago') AS total_pago
FROM expenses.pagamentos p
JOIN expenses.contas c ON c.id = p.conta_id
GROUP BY p.mes_referencia, c.categoria;

-- ------------------------------------------------------------
-- DOWN MIGRATION (rollback completo)
-- ------------------------------------------------------------

-- DROP VIEW  IF EXISTS expenses.v_resumo_mes;
-- DROP TABLE IF EXISTS expenses.parc_mensais;
-- DROP TABLE IF EXISTS expenses.parcelamentos;
-- DROP TABLE IF EXISTS expenses.pagamentos;
-- DROP TABLE IF EXISTS expenses.contas;
-- DROP TYPE  IF EXISTS expenses.status_pagamento;
-- DROP TYPE  IF EXISTS expenses.forma_pagamento;
-- DROP SCHEMA IF EXISTS expenses CASCADE;
