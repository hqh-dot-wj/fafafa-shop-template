/**
 * 从路由 query 解析调度日志列表的「执行状态」初始筛选项（与列表字典一致：0 成功 / 1 失败）
 */
export function parseJobLogStatusFromQuery(raw: unknown): Api.Common.EnableStatus | null {
  const s = typeof raw === 'string' ? raw : undefined;
  return s === '0' || s === '1' ? s : null;
}
