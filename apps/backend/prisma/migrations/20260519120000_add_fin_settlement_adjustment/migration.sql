CREATE TYPE "SettlementAdjustmentType" AS ENUM ('REFUND_DEDUCT', 'COMMISSION_ROLLBACK', 'FEE_ADJUST');

CREATE TYPE "SettlementAdjustmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SETTLED', 'CLOSED');

CREATE TABLE "fin_settlement_adjustment" (
  "id" TEXT NOT NULL,
  "adjustment_no" VARCHAR(100) NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "refund_record_id" TEXT NOT NULL,
  "settlement_bill_id" TEXT,
  "adjustment_type" "SettlementAdjustmentType" NOT NULL DEFAULT 'REFUND_DEDUCT',
  "status" "SettlementAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
  "store_amount_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "commission_amount_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "platform_amount_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "fee_amount_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "reason" VARCHAR(500),
  "raw_payload" JSONB,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fin_settlement_adjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_settlement_adjustment_adjustment_no_key" ON "fin_settlement_adjustment"("adjustment_no");
CREATE UNIQUE INDEX "fin_settlement_adjustment_refund_record_id_key" ON "fin_settlement_adjustment"("refund_record_id");
CREATE INDEX "fin_settlement_adjustment_tenant_id_status_idx" ON "fin_settlement_adjustment"("tenant_id", "status");
CREATE INDEX "fin_settlement_adjustment_order_id_idx" ON "fin_settlement_adjustment"("order_id");
CREATE INDEX "fin_settlement_adjustment_settlement_bill_id_idx" ON "fin_settlement_adjustment"("settlement_bill_id");
CREATE INDEX "fin_settlement_adjustment_create_time_idx" ON "fin_settlement_adjustment"("create_time");

ALTER TABLE "fin_settlement_adjustment"
  ADD CONSTRAINT "fin_settlement_adjustment_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "sys_tenant"("tenant_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fin_settlement_adjustment"
  ADD CONSTRAINT "fin_settlement_adjustment_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "oms_order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fin_settlement_adjustment"
  ADD CONSTRAINT "fin_settlement_adjustment_refund_record_id_fkey"
  FOREIGN KEY ("refund_record_id") REFERENCES "fin_refund"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fin_settlement_adjustment"
  ADD CONSTRAINT "fin_settlement_adjustment_settlement_bill_id_fkey"
  FOREIGN KEY ("settlement_bill_id") REFERENCES "fin_settlement_bill"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
