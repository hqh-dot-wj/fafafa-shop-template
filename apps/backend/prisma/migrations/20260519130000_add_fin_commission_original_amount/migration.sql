-- 佣金原始金额字段（多次部分退款累计扣减的幂等基准）
-- nullable 设计：历史数据 original_amount = null，应用层 fallback 到 amount。
-- 这些历史佣金按设计假设不会再触发部分退款，无需回填。
ALTER TABLE "fin_commission" ADD COLUMN "original_amount" DECIMAL(10,2);
