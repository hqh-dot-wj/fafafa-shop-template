import { TenantContext } from 'src/common/tenant/tenant.context';

export function resolveTenantId(tenantId?: string): string {
  return tenantId || TenantContext.getTenantId() || TenantContext.SUPER_TENANT_ID;
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function readBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return null;
}

export function readBooleanByKeys(rec: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
  for (const key of keys) {
    const value = readBoolean(rec[key]);
    if (value !== null) {
      return value;
    }
  }
  return fallback;
}

export function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function readRuleInt(rules: unknown, key: string, fallback: number): number {
  const rec = toRecord(rules);
  const value = readNumber(rec[key]);
  if (value === null) return fallback;
  return Math.max(0, Math.floor(value));
}

export function readRuleNumber(rules: unknown, key: string, fallback: number): number {
  const rec = toRecord(rules);
  const value = readNumber(rec[key]);
  return value ?? fallback;
}

export function decimalToNumber(value: { toNumber?: () => number } | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
    const parsed = value.toNumber();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function readStringFromRules(rules: unknown, key: string): string | undefined {
  const rec = toRecord(rules);
  const value = readString(rec[key]);
  return value ?? undefined;
}

export function buildActivityContextKey(configId: string): string {
  return `COURSE_GROUP_BUY:${configId}`;
}

export function normalizeOperatorId(
  operatorId: string | number | undefined,
  tenantId: string,
  fallbackPrefix: string,
): string {
  if (operatorId === undefined || operatorId === null) {
    return `${fallbackPrefix}:${tenantId}`;
  }
  return String(operatorId);
}

export function unwrapResultData<T>(value: unknown): T | null {
  if (!value) return null;
  const rec = value as { data?: unknown };
  return (rec.data as T) ?? null;
}
