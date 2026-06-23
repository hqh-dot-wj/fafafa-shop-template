CREATE TABLE "mkt_policy" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(20) NOT NULL,
    "policy_code" TEXT NOT NULL,
    "policy_name" TEXT NOT NULL,
    "policy_type" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "mkt_policy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "mkt_policy_tenant_id_policy_code_key" ON "mkt_policy"("tenant_id", "policy_code");
CREATE INDEX "mkt_policy_tenant_id_policy_type_status_idx" ON "mkt_policy"("tenant_id", "policy_type", "status");
