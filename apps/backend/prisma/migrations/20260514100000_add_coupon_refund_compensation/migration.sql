-- ---------------------------------------------------------------------------
-- 退款过期券补偿机制 (业务决策 B3，问题 7)
-- 1. mkt_coupon_template 加 refund_expire_extend_days：退款时若券已过期，
--    自动延长该天数让用户继续使用（默认 7 天）
-- 2. 新增 mkt_coupon_refund_compensation 表：当模板已下架 / 停用时无法自动延期，
--    走该表降级为运营人工处理，避免静默丢弃用户权益
-- ---------------------------------------------------------------------------

-- CreateEnum
CREATE TYPE "CouponRefundCompensationStatus" AS ENUM ('PENDING', 'RESOLVED', 'CANCELLED');

-- AlterTable: MktCouponTemplate 新增 refund_expire_extend_days 字段
ALTER TABLE "mkt_coupon_template" ADD COLUMN "refund_expire_extend_days" INTEGER NOT NULL DEFAULT 7;

-- CreateTable: MktCouponRefundCompensation
CREATE TABLE "mkt_coupon_refund_compensation" (
    "id" TEXT NOT NULL,
    "tenant_id" VARCHAR(20) NOT NULL,
    "member_id" TEXT NOT NULL,
    "user_coupon_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "original_end_time" TIMESTAMP(3) NOT NULL,
    "reason" VARCHAR(100) NOT NULL,
    "status" "CouponRefundCompensationStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by" VARCHAR(64),
    "resolved_time" TIMESTAMP(3),
    "resolve_remark" VARCHAR(500),
    "create_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_time" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mkt_coupon_refund_compensation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mkt_coupon_refund_compensation_tenant_id_status_idx" ON "mkt_coupon_refund_compensation"("tenant_id", "status");
CREATE INDEX "mkt_coupon_refund_compensation_tenant_id_member_id_idx" ON "mkt_coupon_refund_compensation"("tenant_id", "member_id");
CREATE UNIQUE INDEX "uk_mkt_coupon_refund_comp_user_coupon_order" ON "mkt_coupon_refund_compensation"("user_coupon_id", "order_id");

ALTER TABLE "mkt_coupon_refund_compensation" ADD CONSTRAINT "mkt_coupon_refund_compensation_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "mkt_coupon_template"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
