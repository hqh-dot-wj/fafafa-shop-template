/**
 * 同一 dictType 下若存在重复 dictValue（常见于多次 seed / 导入），
 * UI 会渲染重复选项。保留 dictCode 较小的一条（通常为平台种子数据）。
 */
export function dedupeDictDataByValue(list: Api.System.DictData[]): Api.System.DictData[] {
  if (!list?.length) return [];

  const byValue = new Map<string, Api.System.DictData>();

  for (const item of list) {
    const key = String(item.dictValue ?? '');
    const existing = byValue.get(key);
    if (!existing) {
      byValue.set(key, item);
    } else {
      const existingCode = Number(existing.dictCode ?? Number.MAX_SAFE_INTEGER);
      const itemCode = Number(item.dictCode ?? Number.MAX_SAFE_INTEGER);
      if (itemCode < existingCode) {
        byValue.set(key, item);
      }
    }
  }

  return [...byValue.values()].sort((a, b) => (a.dictSort ?? 0) - (b.dictSort ?? 0));
}
