-- CreateEnum
CREATE TYPE "PointsLotStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PointsFreezeAllocationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PointsConsumeAllocationStatus" AS ENUM ('ACTIVE', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PointsRefundAllocationStrategy" AS ENUM (
  'ORIGINAL_LOT_RESTORE',
  'EXPIRED_LOT_COMPENSATION',
  'NEW_REFUND_TRANSACTION',
  'MANUAL_REVIEW'
);

-- CreateTable
CREATE TABLE "mkt_points_lot" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "account_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "source_transaction_id" TEXT,
  "source_type" "PointsTransactionType",
  "total_amount" INTEGER NOT NULL,
  "available_amount" INTEGER NOT NULL DEFAULT 0,
  "frozen_amount" INTEGER NOT NULL DEFAULT 0,
  "consumed_amount" INTEGER NOT NULL DEFAULT 0,
  "expired_amount" INTEGER NOT NULL DEFAULT 0,
  "expire_time" TIMESTAMP(3),
  "status" "PointsLotStatus" NOT NULL DEFAULT 'ACTIVE',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mkt_points_lot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mkt_points_freeze_allocation" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "account_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "freeze_transaction_id" TEXT NOT NULL,
  "release_transaction_id" TEXT,
  "lot_id" TEXT NOT NULL,
  "related_id" TEXT,
  "amount" INTEGER NOT NULL,
  "status" "PointsFreezeAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mkt_points_freeze_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mkt_points_consume_allocation" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "account_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "spend_transaction_id" TEXT NOT NULL,
  "source_freeze_allocation_id" TEXT,
  "lot_id" TEXT NOT NULL,
  "related_id" TEXT,
  "amount" INTEGER NOT NULL,
  "refundable_amount" INTEGER NOT NULL,
  "status" "PointsConsumeAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mkt_points_consume_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mkt_points_refund_allocation" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "account_id" TEXT NOT NULL,
  "member_id" TEXT NOT NULL,
  "refund_transaction_id" TEXT NOT NULL,
  "source_spend_transaction_id" TEXT,
  "source_consume_allocation_id" TEXT,
  "source_lot_id" TEXT,
  "target_lot_id" TEXT,
  "related_id" TEXT,
  "amount" INTEGER NOT NULL,
  "strategy" "PointsRefundAllocationStrategy" NOT NULL,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mkt_points_refund_allocation_pkey" PRIMARY KEY ("id")
);

-- Backfill initial lots from current account balances.
-- Historical consumed points cannot be reconstructed, so only current available/frozen assets become initial lots.
INSERT INTO "mkt_points_lot" (
  "id",
  "tenant_id",
  "account_id",
  "member_id",
  "source_transaction_id",
  "source_type",
  "total_amount",
  "available_amount",
  "frozen_amount",
  "consumed_amount",
  "expired_amount",
  "expire_time",
  "status",
  "create_time",
  "update_time"
)
SELECT
  concat('pl_', substr(md5(concat("tenant_id", ':', "id", ':initial')), 1, 24)),
  "tenant_id",
  "id",
  "member_id",
  NULL,
  NULL,
  "available_points" + "frozen_points",
  "available_points",
  "frozen_points",
  0,
  0,
  NULL,
  'ACTIVE'::"PointsLotStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "mkt_points_account"
WHERE "available_points" + "frozen_points" > 0;

-- CreateIndex
CREATE INDEX "mkt_points_lot_tenant_id_member_id_expire_time_idx" ON "mkt_points_lot"("tenant_id", "member_id", "expire_time");
CREATE INDEX "mkt_points_lot_account_id_status_expire_time_idx" ON "mkt_points_lot"("account_id", "status", "expire_time");
CREATE INDEX "mkt_points_lot_source_transaction_id_idx" ON "mkt_points_lot"("source_transaction_id");

CREATE UNIQUE INDEX "mkt_points_freeze_allocation_freeze_transaction_id_lot_id_key" ON "mkt_points_freeze_allocation"("freeze_transaction_id", "lot_id");
CREATE INDEX "mkt_points_freeze_allocation_tenant_id_member_id_related_id_idx" ON "mkt_points_freeze_allocation"("tenant_id", "member_id", "related_id");
CREATE INDEX "mkt_points_freeze_allocation_lot_id_status_idx" ON "mkt_points_freeze_allocation"("lot_id", "status");

CREATE INDEX "mkt_points_consume_allocation_tenant_id_member_id_related_id_idx" ON "mkt_points_consume_allocation"("tenant_id", "member_id", "related_id");
CREATE INDEX "mkt_points_consume_allocation_spend_transaction_id_idx" ON "mkt_points_consume_allocation"("spend_transaction_id");
CREATE INDEX "mkt_points_consume_allocation_lot_id_status_idx" ON "mkt_points_consume_allocation"("lot_id", "status");

CREATE INDEX "mkt_points_refund_allocation_tenant_id_member_id_related_id_idx" ON "mkt_points_refund_allocation"("tenant_id", "member_id", "related_id");
CREATE INDEX "mkt_points_refund_allocation_refund_transaction_id_idx" ON "mkt_points_refund_allocation"("refund_transaction_id");
CREATE INDEX "mkt_points_refund_allocation_source_spend_transaction_id_idx" ON "mkt_points_refund_allocation"("source_spend_transaction_id");
CREATE INDEX "mkt_points_refund_allocation_source_lot_id_idx" ON "mkt_points_refund_allocation"("source_lot_id");

-- AddForeignKey
ALTER TABLE "mkt_points_lot" ADD CONSTRAINT "mkt_points_lot_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mkt_points_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_points_lot" ADD CONSTRAINT "mkt_points_lot_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "mkt_points_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mkt_points_freeze_allocation" ADD CONSTRAINT "mkt_points_freeze_allocation_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mkt_points_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_points_freeze_allocation" ADD CONSTRAINT "mkt_points_freeze_allocation_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "mkt_points_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_points_freeze_allocation" ADD CONSTRAINT "mkt_points_freeze_allocation_freeze_transaction_id_fkey" FOREIGN KEY ("freeze_transaction_id") REFERENCES "mkt_points_transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_points_freeze_allocation" ADD CONSTRAINT "mkt_points_freeze_allocation_release_transaction_id_fkey" FOREIGN KEY ("release_transaction_id") REFERENCES "mkt_points_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mkt_points_consume_allocation" ADD CONSTRAINT "mkt_points_consume_allocation_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mkt_points_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_points_consume_allocation" ADD CONSTRAINT "mkt_points_consume_allocation_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "mkt_points_lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_points_consume_allocation" ADD CONSTRAINT "mkt_points_consume_allocation_spend_transaction_id_fkey" FOREIGN KEY ("spend_transaction_id") REFERENCES "mkt_points_transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_points_consume_allocation" ADD CONSTRAINT "mkt_points_consume_allocation_source_freeze_allocation_id_fkey" FOREIGN KEY ("source_freeze_allocation_id") REFERENCES "mkt_points_freeze_allocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mkt_points_refund_allocation" ADD CONSTRAINT "mkt_points_refund_allocation_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "mkt_points_account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_points_refund_allocation" ADD CONSTRAINT "mkt_points_refund_allocation_refund_transaction_id_fkey" FOREIGN KEY ("refund_transaction_id") REFERENCES "mkt_points_transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mkt_points_refund_allocation" ADD CONSTRAINT "mkt_points_refund_allocation_source_spend_transaction_id_fkey" FOREIGN KEY ("source_spend_transaction_id") REFERENCES "mkt_points_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mkt_points_refund_allocation" ADD CONSTRAINT "mkt_points_refund_allocation_source_consume_allocation_id_fkey" FOREIGN KEY ("source_consume_allocation_id") REFERENCES "mkt_points_consume_allocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mkt_points_refund_allocation" ADD CONSTRAINT "mkt_points_refund_allocation_source_lot_id_fkey" FOREIGN KEY ("source_lot_id") REFERENCES "mkt_points_lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "mkt_points_refund_allocation" ADD CONSTRAINT "mkt_points_refund_allocation_target_lot_id_fkey" FOREIGN KEY ("target_lot_id") REFERENCES "mkt_points_lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
