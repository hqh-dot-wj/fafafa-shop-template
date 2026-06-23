CREATE TYPE "OrderOutboxStatus" AS ENUM ('PENDING', 'DISPATCHED', 'FAILED');

CREATE TABLE "oms_order_event_outbox" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" VARCHAR(20) NOT NULL,
    "order_id" TEXT NOT NULL,
    "event_type" VARCHAR(32) NOT NULL,
    "dedupe_key" VARCHAR(160) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OrderOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(500),
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatched_at" TIMESTAMP(3),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oms_order_event_outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oms_order_event_outbox_dedupe_key_key" ON "oms_order_event_outbox"("dedupe_key");
CREATE INDEX "idx_oms_order_outbox_status_avail" ON "oms_order_event_outbox"("status", "available_at");
CREATE INDEX "oms_order_event_outbox_order_id_idx" ON "oms_order_event_outbox"("order_id");
