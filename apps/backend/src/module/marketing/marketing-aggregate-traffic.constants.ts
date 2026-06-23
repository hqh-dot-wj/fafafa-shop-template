/** 出现过 C 端聚合调用的租户集合（用于自动关停扫描范围） */
export const MARKETING_AGGREGATE_TENANT_SET_KEY = 'mkt:agg:tenants';

/** 聚合链路是否出现过历史调用（用于避免首次冷启动直接进入“零调用天数”） */
export function marketingAggregateEverUsedKey(tenantId: string): string {
  return `mkt:agg:everUsed:${tenantId}`;
}

/** 聚合链路按 UTC 日历日统计调用次数 */
export function marketingAggregateDailyCountKey(tenantId: string, yyyymmdd: string): string {
  return `mkt:agg:cnt:${tenantId}:${yyyymmdd}`;
}

/** 聚合链路连续“零调用日”计数（有调用即清零） */
export function marketingAggregateZeroStreakKey(tenantId: string): string {
  return `mkt:agg:zeroStreak:${tenantId}`;
}

export type MarketingCompatEndpoint = 'aggregate' | 'zone';

/** 兼容入口（aggregate/zone）出现过调用的租户集合 */
export const MARKETING_COMPAT_TENANT_SET_KEY = 'mkt:compat:tenants';

/** 兼容入口历史是否出现过调用 */
export function marketingCompatEverUsedKey(tenantId: string, endpoint: MarketingCompatEndpoint): string {
  return `mkt:compat:${endpoint}:everUsed:${tenantId}`;
}

/** 兼容入口按 UTC 日历日统计调用次数 */
export function marketingCompatDailyCountKey(
  tenantId: string,
  endpoint: MarketingCompatEndpoint,
  yyyymmdd: string,
): string {
  return `mkt:compat:${endpoint}:cnt:${tenantId}:${yyyymmdd}`;
}

/** 兼容入口连续“零调用日”计数（有调用即清零） */
export function marketingCompatZeroStreakKey(tenantId: string, endpoint: MarketingCompatEndpoint): string {
  return `mkt:compat:${endpoint}:zeroStreak:${tenantId}`;
}

/** 兼容入口 14 天观测窗口汇总（供任务日志/台账读取） */
export function marketingCompatWindowSummaryKey(tenantId: string, endpoint: MarketingCompatEndpoint): string {
  return `mkt:compat:${endpoint}:windowSummary:${tenantId}`;
}
