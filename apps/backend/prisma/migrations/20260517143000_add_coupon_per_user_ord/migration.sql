-- ---------------------------------------------------------------------------
-- 优惠券领取并发兜底
-- 1. 为 mkt_user_coupon 增加同用户同模板领取序号 per_user_ord
-- 2. 历史数据按 receive_time/id 稳定回填序号
-- 3. 建立 (member_id, template_id, per_user_ord) 唯一索引，让并发 INSERT 由 DB 仲裁
--
-- 回滚提示：
-- 1. DROP INDEX IF EXISTS "uk_user_coupon_per_user_ord";
-- 2. ALTER TABLE "mkt_user_coupon" DROP COLUMN IF EXISTS "per_user_ord";
-- ---------------------------------------------------------------------------

ALTER TABLE "mkt_user_coupon"
  ADD COLUMN IF NOT EXISTS "per_user_ord" INTEGER;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY member_id, template_id
      ORDER BY receive_time ASC, id ASC
    ) AS rn
  FROM "mkt_user_coupon"
  WHERE "per_user_ord" IS NULL
)
UPDATE "mkt_user_coupon" coupon
SET "per_user_ord" = ranked.rn
FROM ranked
WHERE coupon.id = ranked.id;

ALTER TABLE "mkt_user_coupon"
  ALTER COLUMN "per_user_ord" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uk_user_coupon_per_user_ord"
  ON "mkt_user_coupon"("member_id", "template_id", "per_user_ord");
