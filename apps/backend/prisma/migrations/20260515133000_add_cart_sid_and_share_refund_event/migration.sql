ALTER TYPE "DistShareEventType" ADD VALUE IF NOT EXISTS 'ORDER_REFUND_REVERSED';

ALTER TABLE "oms_cart_item"
  ADD COLUMN IF NOT EXISTS "sid" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "idx_oms_cart_item_member_sid"
  ON "oms_cart_item"("member_id", "tenant_id", "sid");
