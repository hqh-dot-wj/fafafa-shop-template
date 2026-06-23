-- 生产首次部署最小种子：play_definition（API PlayDispatcher 启动必需）
-- 幂等：按 code 冲突更新

INSERT INTO play_definition (
  id, code, name, has_instance, has_state, can_fail, can_parallel,
  default_stock_mode, handler_class_name, description, is_active, create_time, update_time
) VALUES
  ('prod_play_COURSE_GROUP_BUY', 'COURSE_GROUP_BUY', '拼班课程', true, true, true, true, 'LAZY_CHECK', 'CourseGroupBuyService', '课程拼团，人数达到要求后开班，需设置上课时间和地址', true, NOW(), NOW()),
  ('prod_play_FLASH_SALE', 'FLASH_SALE', '限时秒杀', true, true, false, false, 'STRONG_LOCK', 'FlashSaleService', '限量商品先到先得，必须使用强锁定库存模式', true, NOW(), NOW()),
  ('prod_play_MEMBER_UPGRADE', 'MEMBER_UPGRADE', '会员升级', true, true, false, false, 'LAZY_CHECK', 'MemberUpgradeService', '用户支付升级费用后提升会员等级', true, NOW(), NOW()),
  ('prod_play_NEWCOMER_EXCLUSIVE', 'NEWCOMER_EXCLUSIVE', '新人专享', false, false, false, false, 'LAZY_CHECK', 'NewcomerHandler', '新人绑定或领取后发放权益，并支持新人价覆盖', true, NOW(), NOW()),
  ('prod_play_DISTRIBUTION_GROWTH', 'DISTRIBUTION_GROWTH', '分销成长', false, false, false, true, 'LAZY_CHECK', 'DistributionGrowthHandler', '分销成长活动配置，由分销与佣金域执行奖励', true, NOW(), NOW()),
  ('prod_play_POLICY_EVAL', 'POLICY_EVAL', '配置型营销策略', false, false, false, true, 'LAZY_CHECK', 'PolicyEvaluatorAdapter', '配置型 campaign 的统一策略评估 sentinel', true, NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  has_instance = EXCLUDED.has_instance,
  has_state = EXCLUDED.has_state,
  can_fail = EXCLUDED.can_fail,
  can_parallel = EXCLUDED.can_parallel,
  default_stock_mode = EXCLUDED.default_stock_mode,
  handler_class_name = EXCLUDED.handler_class_name,
  description = EXCLUDED.description,
  is_active = true,
  update_time = NOW();
