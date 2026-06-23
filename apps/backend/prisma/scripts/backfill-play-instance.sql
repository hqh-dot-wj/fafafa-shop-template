-- 回填已有 PlayInstance 的 orderId 和 orderItemId
UPDATE mkt_play_instance pi
SET order_id = o.id,
    order_item_id = (
      SELECT oi.id FROM oms_order_item oi
      WHERE oi.order_id = o.id
      ORDER BY oi.id
      LIMIT 1
    )
FROM oms_order o
WHERE pi.order_sn = o.order_sn
  AND pi.order_sn IS NOT NULL
  AND pi.order_id IS NULL;
