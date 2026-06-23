-- OmsOrder：与全库 delFlag 软删对齐；delete_time 保留作审计
ALTER TABLE "oms_order" ADD COLUMN "del_flag" "DelFlag" NOT NULL DEFAULT '0';

UPDATE "oms_order" SET "del_flag" = '1' WHERE "delete_time" IS NOT NULL;

CREATE INDEX "oms_order_del_flag_idx" ON "oms_order"("del_flag");
