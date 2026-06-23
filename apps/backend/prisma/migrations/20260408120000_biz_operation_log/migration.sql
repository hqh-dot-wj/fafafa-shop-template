-- 业务操作日志（订单改价/退款/核销、会员等级与积分等可追溯记录）
CREATE TABLE "biz_operation_log" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(20) NOT NULL,
    "operator_id" VARCHAR(64) NOT NULL,
    "operator_name" VARCHAR(64) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(32) NOT NULL,
    "target_id" VARCHAR(64) NOT NULL,
    "detail" VARCHAR(4000),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biz_operation_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "biz_operation_log_tenant_target_time_idx" ON "biz_operation_log"("tenant_id", "target_type", "target_id", "create_time" DESC);
