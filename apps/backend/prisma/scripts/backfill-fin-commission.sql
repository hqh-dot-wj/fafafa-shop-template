-- 回填 FinCommission 的 orderItemId（单 item 订单直接填入）
UPDATE fin_commission fc
SET order_item_id = (
  SELECT oi.id FROM oms_order_item oi
  WHERE oi.order_id = fc.order_id
  ORDER BY oi.id
  LIMIT 1
)
WHERE fc.order_item_id IS NULL;
