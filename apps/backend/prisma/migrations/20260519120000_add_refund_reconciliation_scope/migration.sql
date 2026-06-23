ALTER TYPE "ReconciliationBizScope" ADD VALUE IF NOT EXISTS 'REFUND';

ALTER TABLE "fin_channel_statement_line"
  ADD COLUMN IF NOT EXISTS "amount_kind" VARCHAR(30) NOT NULL DEFAULT 'PAYMENT',
  ADD COLUMN IF NOT EXISTS "payer_refund_amount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "settlement_refund_amount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "refund_fee_amount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "discount_refund_amount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "net_amount" DECIMAL(10,2);

ALTER TABLE "fin_reconciliation_result"
  ADD COLUMN IF NOT EXISTS "local_amount_breakdown" JSONB,
  ADD COLUMN IF NOT EXISTS "channel_amount_breakdown" JSONB;
