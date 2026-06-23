interface NextSortOptions {
  /** 数据为空时的默认起始值 */
  fallback?: number;
  /** 递增步长 */
  step?: number;
}

function normalizeSortValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

/**
 * 从列表中计算“下一个排序值”（max + step）
 */
export function getNextSortValue<T>(
  items: readonly T[],
  pickSort: (item: T) => unknown,
  options?: NextSortOptions,
): number {
  const fallback = options?.fallback ?? 1;
  const step = options?.step ?? 1;
  let maxSort: number | null = null;

  for (const item of items) {
    const normalized = normalizeSortValue(pickSort(item));
    if (normalized !== null && (maxSort === null || normalized > maxSort)) {
      maxSort = normalized;
    }
  }

  if (maxSort === null) {
    return fallback;
  }

  return maxSort + step;
}
