-- BUG-5 数据回填：为历史部分退款订单设置 partial_refund_sn 哨兵值
--
-- 背景：
--   partial_refund_sn 列于 feature/commission-review 引入，替代旧的 remark 字符串检测。
--   迁移脚本（add-partial-refund-sn-and-transaction-unique.sql）只添加了列，未回填历史数据。
--
--   新代码逻辑：
--     - 整单退款时：检查 partial_refund_sn IS NOT NULL → 拒绝
--     - 部分退款时：检查 partial_refund_sn IS NOT NULL → 拒绝（防止二次部分退款）
--     - 部分退款成功：写入 partial_refund_sn = <生成的退款单号>
--
--   风险：历史部分退款订单（partial_refund_sn IS NULL）可能被新代码误允许整单退款或二次部分退款。
--
-- 识别逻辑：
--   订单存在 CANCELLED 状态的佣金记录，且订单本身未完全退款（status != 'REFUNDED'）。
--   推导：佣金被取消 + 订单仍存在（非全退）= 该订单经历过部分退款（由旧代码处理）。
--
-- 哨兵值：'LEGACY_PARTIAL_REFUND'
--   - 非空 → 新代码的 != null 判断触发，阻止二次退款
--   - 明确标记来源，便于排查
--
-- 执行前必读：
--   1. 在测试环境先验证 SELECT 版本的影响行数
--   2. 业务低峰期执行（涉及行锁）
--   3. 若回填行数异常偏多，先人工核查佣金取消原因（可能包含手动取消的佣金）
--   4. 此脚本幂等：WHERE partial_refund_sn IS NULL 确保重复执行安全

-- ============================================================
-- 第一步：核查（不更新，先看受影响范围）
-- ============================================================
SELECT
  o.id,
  o.order_sn,
  o.status,
  o.tenant_id,
  o.pay_time,
  COUNT(c.id)   AS cancelled_commission_count,
  o.remark
FROM oms_order o
JOIN fin_commission c
  ON c.order_id = o.id
 AND c.status = 'CANCELLED'
WHERE o.partial_refund_sn IS NULL
  AND o.status != 'REFUNDED'
GROUP BY o.id, o.order_sn, o.status, o.tenant_id, o.pay_time, o.remark
HAVING COUNT(c.id) > 0
ORDER BY o.pay_time DESC;

-- ============================================================
-- 第二步：执行回填（确认第一步结果无误后取消注释执行）
-- ============================================================

-- UPDATE oms_order o
-- SET partial_refund_sn = 'LEGACY_PARTIAL_REFUND',
--     update_time = NOW()
-- WHERE o.partial_refund_sn IS NULL
--   AND o.status != 'REFUNDED'
--   AND EXISTS (
--     SELECT 1
--     FROM fin_commission c
--     WHERE c.order_id = o.id
--       AND c.status = 'CANCELLED'
--   );

-- ============================================================
-- 第三步：验证（回填后确认）
-- ============================================================
-- SELECT COUNT(*) AS remaining_unfilled
-- FROM oms_order o
-- WHERE o.partial_refund_sn IS NULL
--   AND o.status != 'REFUNDED'
--   AND EXISTS (
--     SELECT 1
--     FROM fin_commission c
--     WHERE c.order_id = o.id
--       AND c.status = 'CANCELLED'
--   );
-- 预期结果：0
