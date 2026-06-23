-- 先确认所有 orderItemId 已回填（无 NULL）
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM fin_commission WHERE order_item_id IS NULL) THEN
    RAISE EXCEPTION '存在未回填 orderItemId 的佣金记录，请先执行 backfill-fin-commission.sql';
  END IF;
END $$;

-- 修改字段为非空
ALTER TABLE fin_commission ALTER COLUMN order_item_id SET NOT NULL;

-- 删除旧唯一索引（Prisma 历史迁移为 CREATE UNIQUE INDEX，非 TABLE CONSTRAINT）
DROP INDEX IF EXISTS "fin_commission_order_id_beneficiary_id_level_key";

-- 创建新唯一约束
ALTER TABLE fin_commission ADD CONSTRAINT fin_commission_order_id_order_item_id_beneficiary_id_level_key 
  UNIQUE (order_id, order_item_id, beneficiary_id, level);
