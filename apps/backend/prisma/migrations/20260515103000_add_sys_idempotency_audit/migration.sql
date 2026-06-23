CREATE TABLE "sys_idempotency_audit" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" VARCHAR(20) NOT NULL,
    "idem_key" VARCHAR(160) NOT NULL,
    "layer" VARCHAR(20) NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "metadata" JSONB,
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_idempotency_audit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sys_idempotency_audit_idem_key_create_time_idx" ON "sys_idempotency_audit"("idem_key", "create_time");
CREATE INDEX "sys_idempotency_audit_tenant_id_create_time_idx" ON "sys_idempotency_audit"("tenant_id", "create_time");
