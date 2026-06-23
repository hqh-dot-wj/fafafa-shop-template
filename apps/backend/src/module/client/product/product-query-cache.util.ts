import * as crypto from 'crypto';
import { TenantContext } from 'src/common/tenant/tenant.context';

const MIN_SEARCH_KEYWORD_LENGTH = 2;
const MAX_SEARCH_KEYWORD_LENGTH = 50;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE_NUM = 1;

export interface NormalizedProductListQuery {
  name?: string;
  categoryId?: number;
  type?: string;
  pageNum: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface ProductListCachePayload {
  rows: unknown[];
  total: number;
}

type ProductQueryInput = {
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'string') return first;
  }
  return undefined;
}

function normalizePositiveInt(raw: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

export function normalizeProductListQuery(query: Record<string, unknown>): NormalizedProductListQuery {
  const pageNum = normalizePositiveInt(query.pageNum, DEFAULT_PAGE_NUM, DEFAULT_PAGE_NUM, Number.MAX_SAFE_INTEGER);
  const pageSize = normalizePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);

  const trimmedName = (firstString(query.name) ?? '').trim();
  let normalizedName: string | undefined;
  if (trimmedName.length >= MIN_SEARCH_KEYWORD_LENGTH) {
    normalizedName = trimmedName.slice(0, MAX_SEARCH_KEYWORD_LENGTH);
  }

  const categoryIdRaw = query.categoryId;
  const categoryIdParsed = Number(categoryIdRaw);
  const categoryId =
    Number.isFinite(categoryIdParsed) && categoryIdParsed > 0 ? Math.trunc(categoryIdParsed) : undefined;

  const type = firstString(query.type)?.trim() || undefined;

  return {
    name: normalizedName,
    categoryId,
    type,
    pageNum,
    pageSize,
    skip: (pageNum - 1) * pageSize,
    take: pageSize,
  };
}

export function buildProductListCacheKey(tenantId: string, query: NormalizedProductListQuery): string {
  const queryDigest = crypto
    .createHash('md5')
    .update(
      JSON.stringify({
        name: query.name || '',
        categoryId: query.categoryId ?? null,
        type: query.type || '',
        pageNum: query.pageNum,
        pageSize: query.pageSize,
      }),
    )
    .digest('hex');
  return `client:product:list:${tenantId}:${queryDigest}`;
}

export function buildProductListStaleCacheKey(cacheKey: string): string {
  return `${cacheKey}:stale`;
}

export function buildProductListTenantSnapshotCacheKey(tenantId: string): string {
  return `client:product:list:snapshot:${tenantId}`;
}

export function resolveTenantIdForProductQuery(input: ProductQueryInput): string {
  const tenantFromHeader = firstString(input.headers?.['tenant-id'])?.trim();
  if (tenantFromHeader) return tenantFromHeader;

  const tenantFromQuery = firstString(input.query?.tenantId)?.trim();
  if (tenantFromQuery) return tenantFromQuery;

  return TenantContext.SUPER_TENANT_ID;
}

export function isClientProductListPath(rawPath?: string): boolean {
  if (!rawPath) return false;
  const path = rawPath.split('?')[0] ?? rawPath;
  return path.endsWith('/client/product/list') || path.endsWith('/client/product/list/');
}
