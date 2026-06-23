/** 与 `schema.prisma` 中 `SysOperLog.operParam` / `jsonResult` / `errorMsg` 的 @db.VarChar(2000) 对齐 */
export const SYS_OPER_LOG_VARCHAR_MAX = 2000;

/**
 * 截断操作日志中的长文本，避免大 JSON（如商品 detailHtml）落库失败拖垮请求与 SSE。
 */
export function clipSysOperLogVarchar(s: string, maxChars: number = SYS_OPER_LOG_VARCHAR_MAX): string {
  if (s.length <= maxChars) {
    return s;
  }
  const ellipsis = '\n...[truncated]';
  const take = Math.max(0, maxChars - ellipsis.length);
  return take > 0 ? `${s.slice(0, take)}${ellipsis}` : ellipsis.slice(0, maxChars);
}
