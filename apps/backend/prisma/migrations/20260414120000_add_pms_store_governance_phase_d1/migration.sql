-- D1: 门店商品治理基础结构（审核态、模板版本、幂等）

-- 1) 门店商品审核态枚举
DO $$ BEGIN
  CREATE TYPE "StoreProductAuditStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2) 门店商品审核字段
ALTER TABLE "pms_tenant_product"
  ADD COLUMN IF NOT EXISTS "audit_status" "StoreProductAuditStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "audit_reason" VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "audit_by" VARCHAR(64),
  ADD COLUMN IF NOT EXISTS "audit_time" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sync_blocked_reason" VARCHAR(500);

CREATE INDEX IF NOT EXISTS "pms_tenant_product_audit_status_idx"
  ON "pms_tenant_product"("audit_status");

CREATE INDEX IF NOT EXISTS "pms_tenant_product_tenant_audit_idx"
  ON "pms_tenant_product"("tenant_id", "audit_status");

-- 3) 模板版本快照表
CREATE TABLE IF NOT EXISTS "pms_attr_template_version" (
  "version_id" TEXT NOT NULL,
  "template_id" INTEGER NOT NULL,
  "template_code" VARCHAR(64) NOT NULL,
  "version" INTEGER NOT NULL,
  "schema_snapshot" JSONB NOT NULL,
  "is_latest" BOOLEAN NOT NULL DEFAULT true,
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pms_attr_template_version_pkey" PRIMARY KEY ("version_id"),
  CONSTRAINT "pms_attr_template_version_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "pms_attr_template"("template_id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "pms_attr_template_version_template_id_version_key"
  ON "pms_attr_template_version"("template_id", "version");

CREATE INDEX IF NOT EXISTS "pms_attr_template_version_template_code_version_idx"
  ON "pms_attr_template_version"("template_code", "version");

-- 4) 业务幂等记录表
CREATE TABLE IF NOT EXISTS "biz_idempotency_record" (
  "id" TEXT NOT NULL,
  "tenant_id" VARCHAR(20) NOT NULL,
  "operation_id" VARCHAR(64) NOT NULL,
  "action" VARCHAR(64) NOT NULL,
  "request_hash" VARCHAR(128) NOT NULL,
  "response_snapshot" JSONB,
  "expire_time" TIMESTAMP(3),
  "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "biz_idempotency_record_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "uk_biz_idempotency_tenant_operation_action"
  ON "biz_idempotency_record"("tenant_id", "operation_id", "action");

CREATE INDEX IF NOT EXISTS "biz_idempotency_record_tenant_create_time_idx"
  ON "biz_idempotency_record"("tenant_id", "create_time");
