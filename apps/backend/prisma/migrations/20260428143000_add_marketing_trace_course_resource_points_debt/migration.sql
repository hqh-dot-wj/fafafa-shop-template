-- CreateEnum
CREATE TYPE "MktTraceKind" AS ENUM ('SCENE_RESOLVE', 'CACHE_INVALIDATION');

-- CreateEnum
CREATE TYPE "MktTraceStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PointsDebtStatus" AS ENUM ('OPEN', 'PARTIAL', 'RESOLVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PointsDebtReason" AS ENUM ('ORDER_REFUND_CLAWBACK_INSUFFICIENT');

-- AlterTable
ALTER TABLE "mkt_course_schedule"
  ADD COLUMN "teacher_id" VARCHAR(64),
  ADD COLUMN "teacher_name" VARCHAR(100),
  ADD COLUMN "classroom_id" VARCHAR(64),
  ADD COLUMN "classroom_name" VARCHAR(100),
  ADD COLUMN "location" VARCHAR(255),
  ADD COLUMN "capacity" INTEGER,
  ADD COLUMN "service_capacity" INTEGER,
  ADD COLUMN "resource_snapshot" JSONB;

-- CreateTable
CREATE TABLE "mkt_scene_resolve_trace" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "trace_id" VARCHAR(120) NOT NULL,
  "trace_kind" "MktTraceKind" NOT NULL,
  "scene_code" VARCHAR(80),
  "release_no" INTEGER,
  "channel" VARCHAR(40),
  "status" "MktTraceStatus" NOT NULL DEFAULT 'SUCCESS',
  "module_count" INTEGER,
  "empty_module_count" INTEGER,
  "duration_ms" INTEGER NOT NULL DEFAULT 0,
  "event_type" VARCHAR(120),
  "deleted_keys" INTEGER,
  "snapshot_json" JSONB,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mkt_scene_resolve_trace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mkt_points_debt" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "account_id" TEXT,
  "member_id" TEXT NOT NULL,
  "source_transaction_id" TEXT,
  "related_id" TEXT,
  "related_type" VARCHAR(50),
  "reason" "PointsDebtReason" NOT NULL,
  "status" "PointsDebtStatus" NOT NULL DEFAULT 'OPEN',
  "expected_amount" INTEGER NOT NULL,
  "deducted_amount" INTEGER NOT NULL DEFAULT 0,
  "debt_amount" INTEGER NOT NULL,
  "available_at_create" INTEGER NOT NULL DEFAULT 0,
  "remark" VARCHAR(500),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "update_time" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mkt_points_debt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mkt_course_schedule_tenant_id_teacher_id_date_idx" ON "mkt_course_schedule"("tenant_id", "teacher_id", "date");
CREATE INDEX "mkt_course_schedule_tenant_id_classroom_id_date_idx" ON "mkt_course_schedule"("tenant_id", "classroom_id", "date");

CREATE INDEX "mkt_scene_resolve_trace_tenant_id_trace_id_create_time_idx" ON "mkt_scene_resolve_trace"("tenant_id", "trace_id", "create_time");
CREATE INDEX "mkt_scene_resolve_trace_tenant_id_scene_code_create_time_idx" ON "mkt_scene_resolve_trace"("tenant_id", "scene_code", "create_time");
CREATE INDEX "mkt_scene_resolve_trace_tenant_id_trace_kind_create_time_idx" ON "mkt_scene_resolve_trace"("tenant_id", "trace_kind", "create_time");

CREATE UNIQUE INDEX "uk_mkt_points_debt_biz" ON "mkt_points_debt"("tenant_id", "member_id", "related_id", "reason");
CREATE INDEX "mkt_points_debt_tenant_id_member_id_status_idx" ON "mkt_points_debt"("tenant_id", "member_id", "status");
CREATE INDEX "mkt_points_debt_related_id_idx" ON "mkt_points_debt"("related_id");
CREATE INDEX "mkt_points_debt_source_transaction_id_idx" ON "mkt_points_debt"("source_transaction_id");

-- AddForeignKey
ALTER TABLE "mkt_points_debt" ADD CONSTRAINT "mkt_points_debt_source_transaction_id_fkey" FOREIGN KEY ("source_transaction_id") REFERENCES "mkt_points_transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
