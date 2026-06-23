-- ---------------------------------------------------------------------------
-- 修复优惠券使用记录重复写入 (问题 4)
-- 1. 对历史可能存在的 (user_coupon_id, order_id) 重复行做幂等去重，保留 used_time 最早一条
-- 2. 删除前将所有待删除审计行写入备份表，保留回滚与验账证据
-- 3. 建立 (user_coupon_id, order_id) 唯一约束，从数据库层兜底应用层幂等
--
-- 回滚提示：
-- 1. DROP INDEX IF EXISTS "uk_mkt_coupon_usage_user_coupon_order";
-- 2. 从 "mkt_coupon_usage_dedup_backup_20260514090000" 按 id 反插回 "mkt_coupon_usage"。
-- ---------------------------------------------------------------------------

-- Step 1: 建立去重备份表；只存本次 migration 会删除的重复审计行
CREATE TABLE IF NOT EXISTS "mkt_coupon_usage_dedup_backup_20260514090000"
(LIKE "mkt_coupon_usage" INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES);

ALTER TABLE "mkt_coupon_usage_dedup_backup_20260514090000"
    ADD COLUMN IF NOT EXISTS "backup_reason" TEXT NOT NULL DEFAULT 'dedupe before uk_mkt_coupon_usage_user_coupon_order',
    ADD COLUMN IF NOT EXISTS "backed_up_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

INSERT INTO "mkt_coupon_usage_dedup_backup_20260514090000" (
    id,
    tenant_id,
    user_coupon_id,
    member_id,
    order_id,
    discount_amount,
    order_amount,
    used_time,
    backup_reason,
    backed_up_at
)
SELECT
    t.id,
    t.tenant_id,
    t.user_coupon_id,
    t.member_id,
    t.order_id,
    t.discount_amount,
    t.order_amount,
    t.used_time,
    'dedupe duplicate mkt_coupon_usage row before unique index',
    CURRENT_TIMESTAMP
FROM "mkt_coupon_usage" t
JOIN (
    SELECT id
    FROM (
        SELECT id,
               row_number() OVER (
                   PARTITION BY user_coupon_id, order_id
                   ORDER BY used_time ASC, id ASC
               ) AS rn
        FROM "mkt_coupon_usage"
    ) ranked
    WHERE ranked.rn > 1
) duplicates ON duplicates.id = t.id
ON CONFLICT (id) DO NOTHING;

-- Step 2: 去重 — 仅删除已进入备份表的重复行
DELETE FROM "mkt_coupon_usage" t
USING "mkt_coupon_usage_dedup_backup_20260514090000" backup
WHERE t.id = backup.id;

-- Step 3: 创建唯一约束 (Prisma schema @@unique([userCouponId, orderId]) 对应)
CREATE UNIQUE INDEX "uk_mkt_coupon_usage_user_coupon_order" ON "mkt_coupon_usage"("user_coupon_id", "order_id");
