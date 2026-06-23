import { localStg } from '@/utils/storage';

function normalizeTenantId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const tenantId = value.trim();
  return tenantId || null;
}

export function getStoredTenantId(): string | null {
  return normalizeTenantId(localStg.get('tenantId'));
}

export function resolveTenantIdOrThrow(value: unknown, context: string): string {
  const tenantId = normalizeTenantId(value) ?? getStoredTenantId();
  if (tenantId) return tenantId;
  throw new Error(`${context}缺少租户上下文，请重新选择租户后重试`);
}

export function shouldRequireTenantHeader(url: string | undefined): boolean {
  if (!url) return true;
  return !url.startsWith('/auth/');
}
