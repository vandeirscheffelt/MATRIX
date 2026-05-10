-- Fase 8: Dual gateway de pagamento (AppMax + Stripe)
ALTER TABLE atendente_ia.subscriptions
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS appmax_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS appmax_subscription_id TEXT;
