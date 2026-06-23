CREATE TYPE "FinRefundStatus" AS ENUM ('CREATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'CLOSED', 'ABNORMAL');

CREATE TYPE "FinRefundType" AS ENUM ('FULL', 'PARTIAL', 'AUTO_CANCEL');

CREATE TYPE "FinRefundEventType" AS ENUM ('REQUEST', 'SYNC_RESPONSE', 'NOTIFY', 'QUERY', 'MANUAL');

CREATE TABLE "fin_refund" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "order_sn" VARCHAR(100) NOT NULL,
  "refund_sn" VARCHAR(100) NOT NULL,
  "refund_id" VARCHAR(100),
  "channel_type" VARCHAR(30) NOT NULL DEFAULT 'WECHAT',
  "status" "FinRefundStatus" NOT NULL DEFAULT 'CREATED',
  "refund_type" "FinRefundType" NOT NULL,
  "requested_amount" DECIMAL(10,2) NOT NULL,
  "payer_refund_amount" DECIMAL(10,2),
  "settlement_refund_amount" DECIMAL(10,2),
  "refund_fee_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "discount_refund_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "payer_total_amount" DECIMAL(10,2),
  "settlement_total_amount" DECIMAL(10,2),
  "funds_account" VARCHAR(50),
  "reason" VARCHAR(500),
  "fail_reason" VARCHAR(500),
  "success_time" TIMESTAMP(3),
  "last_query_time" TIMESTAMP(3),
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "raw_payload" JSONB,
  "finalize_payload" JSONB,
  "finalized_at" TIMESTAMP(3),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fin_refund_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fin_refund_event" (
  "id" TEXT NOT NULL,
  "refund_record_id" TEXT NOT NULL,
  "event_type" "FinRefundEventType" NOT NULL,
  "from_status" "FinRefundStatus",
  "to_status" "FinRefundStatus" NOT NULL,
  "payload" JSONB,
  "operator" VARCHAR(100),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fin_refund_event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fin_refund_refund_sn_key" ON "fin_refund"("refund_sn");
CREATE INDEX "fin_refund_tenant_id_status_idx" ON "fin_refund"("tenant_id", "status");
CREATE INDEX "fin_refund_order_id_status_idx" ON "fin_refund"("order_id", "status");
CREATE INDEX "fin_refund_refund_id_idx" ON "fin_refund"("refund_id");
CREATE INDEX "fin_refund_event_refund_record_id_create_time_idx" ON "fin_refund_event"("refund_record_id", "create_time");
CREATE INDEX "fin_refund_event_event_type_create_time_idx" ON "fin_refund_event"("event_type", "create_time");

ALTER TABLE "fin_refund"
  ADD CONSTRAINT "fin_refund_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "oms_order"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "fin_refund_event"
  ADD CONSTRAINT "fin_refund_event_refund_record_id_fkey"
  FOREIGN KEY ("refund_record_id") REFERENCES "fin_refund"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
