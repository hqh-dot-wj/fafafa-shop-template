/**
 * 接口返回的 specDef 可能为错误形态（如 [[],[],[]]），或与 globalSkus.specValues 不一致。
 * 统一规范为 Step3 使用的 [{ name, values[] }]。
 */

export function normalizeSpecDefFromApi(raw: unknown): Array<{ name: string; values: string[] }> {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: Array<{ name: string; values: string[] }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const rec = item as { name?: unknown; values?: unknown };
    const name = rec.name != null ? String(rec.name).trim() : '';
    if (!name) {
      continue;
    }
    const values = Array.isArray(rec.values)
      ? rec.values.map((v) => String(v).trim()).filter((v) => v.length > 0)
      : [];
    if (values.length > 0) {
      out.push({ name, values });
    }
  }
  return out;
}

function parseSpecValues(sku: { specValues?: Record<string, string> | string }): Record<string, string> | null {
  const raw = sku.specValues;
  if (raw == null) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string>) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, string>;
  }
  return null;
}

/** 从已落库的 SKU 行反推规格勾选（多 SKU 时对每个规格名做值去重合并） */
export function buildSpecDefFromGlobalSkus(
  skus: Array<{ specValues?: Record<string, string> | string }>,
): Array<{ name: string; values: string[] }> {
  if (!Array.isArray(skus) || skus.length === 0) {
    return [];
  }

  const nameOrder: string[] = [];
  const valueSets = new Map<string, Set<string>>();

  for (const sku of skus) {
    const sv = parseSpecValues(sku);
    if (!sv) {
      continue;
    }
    for (const [name, val] of Object.entries(sv)) {
      const n = name.trim();
      const v = val != null ? String(val).trim() : '';
      if (!n || !v) {
        continue;
      }
      if (!valueSets.has(n)) {
        valueSets.set(n, new Set());
        nameOrder.push(n);
      }
      valueSets.get(n)!.add(v);
    }
  }

  return nameOrder.map((name) => ({
    name,
    values: [...(valueSets.get(name) ?? [])],
  }));
}

export function resolveProductSpecDefForForm(
  apiSpecDef: unknown,
  globalSkus: Array<{ specValues?: Record<string, string> | string }> | undefined,
): Array<{ name: string; values: string[] }> {
  const normalized = normalizeSpecDefFromApi(apiSpecDef);
  if (normalized.length > 0) {
    return normalized;
  }
  return buildSpecDefFromGlobalSkus(globalSkus ?? []);
}
