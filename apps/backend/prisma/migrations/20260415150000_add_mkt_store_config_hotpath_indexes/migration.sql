-- mkt_store_config 高频查询索引：
-- 1) 商品主活动裁决（tenant + serviceId + 状态）
-- 2) 门店聚合列表（tenant + aggregateEnabled + 状态 + serviceId）
-- 3) 平台聚合列表（跨租户按状态聚合 serviceId）

CREATE INDEX IF NOT EXISTS idx_mkt_store_config_tenant_service_status_del
  ON mkt_store_config (tenant_id, service_id, status, del_flag);

CREATE INDEX IF NOT EXISTS idx_mkt_store_config_aggregate_scan
  ON mkt_store_config (tenant_id, aggregate_enabled, status, del_flag, service_id);

CREATE INDEX IF NOT EXISTS idx_mkt_store_config_platform_aggregate
  ON mkt_store_config (status, del_flag, aggregate_enabled, service_id);
