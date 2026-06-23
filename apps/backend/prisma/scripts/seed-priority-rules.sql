-- 为所有现有租户初始化默认活动优先级规则
-- 使用 ON CONFLICT 避免重复插入
INSERT INTO mkt_activity_priority_rule (id, tenant_id, activity_type, priority, aggregate_enabled, zone_enabled, manual_lock_enabled)
SELECT 
  gen_random_uuid()::text,
  t.tenant_id,
  activity.type,
  activity.priority,
  true,
  true,
  false
FROM (SELECT DISTINCT tenant_id FROM sys_tenant WHERE del_flag = '0') t
CROSS JOIN (VALUES 
  ('FLASH_SALE', 100),
  ('COURSE_GROUP_BUY', 80),
  ('MEMBER_UPGRADE', 60),
  ('NEWCOMER', 50),
  ('MEMBER_PRICE', 30)
) AS activity(type, priority)
ON CONFLICT (tenant_id, activity_type) DO NOTHING;
