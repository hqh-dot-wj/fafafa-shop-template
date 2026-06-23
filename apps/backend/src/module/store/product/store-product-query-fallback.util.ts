import { createHash } from 'crypto';
import { resolveRateLimitTenantId } from 'src/common/guards/rate-limit-key.util';

export type StoreProductQueryRequestLike = {
  headers?: Record<string, unknown>;
  body?: Record<string, unknown>;
  path?: string;
};

export type NormalizedStoreProductListQuery = {
  name?: string;
  type?: string;
  status?: string;
  auditStatus?: string;
  storeId?: string;
  pageNum: number;
  pageSize: number;
  orderByColumn?: string;
  isAsc?: string;
};

const STORE_PRODUCT_LIST_CACHE_PREFIX = 'store:product:list:cache:';
const STORE_PRODUCT_LIST_SNAPSHOT_PREFIX = 'store:product:list:snapshot:';
const ADMIN_STORE_PRODUCT_LIST_SUFFIXES = [
  '/store/product/list',
  '/store/product/draft/list',
  '/store/product/review/list',
];
const MIN_SEARCH_KEYWORD_LENGTH = 2;
const MAX_SEARCH_KEYWORD_LENGTH = 50;

const toPositiveInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeKeyword = (value: unknown): string | undefined => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return undefined;
  if (normalized.length < MIN_SEARCH_KEYWORD_LENGTH) return undefined;
  return normalized.slice(0, MAX_SEARCH_KEYWORD_LENGTH);
};

export const normalizeStoreProductListQuery = (body?: Record<string, unknown>): NormalizedStoreProductListQuery => ({
  name: normalizeKeyword(body?.name),
  type: normalizeOptionalString(body?.type),
  status: normalizeOptionalString(body?.status),
  auditStatus: normalizeOptionalString(body?.auditStatus),
  storeId: normalizeOptionalString(body?.storeId),
  pageNum: toPositiveInt(body?.pageNum, 1, 1, 100_000),
  pageSize: toPositiveInt(body?.pageSize, 20, 1, 100),
  orderByColumn: normalizeOptionalString(body?.orderByColumn),
  isAsc: normalizeOptionalString(body?.isAsc)?.toLowerCase(),
});

export const normalizeAdminStoreProductPath = (path: string | undefined): string | null => {
  if (!path) return null;
  const normalizedPath = path.split('?')[0] || '';
  for (const suffix of ADMIN_STORE_PRODUCT_LIST_SUFFIXES) {
    if (normalizedPath.endsWith(suffix)) {
      return suffix.replace(/\//g, ':');
    }
  }
  return null;
};

export const isAdminStoreProductListPath = (path: string | undefined): boolean =>
  normalizeAdminStoreProductPath(path) !== null;

const buildStoreProductListQueryDigest = (query: NormalizedStoreProductListQuery): string =>
  createHash('md5')
    .update(
      JSON.stringify({
        name: query.name ?? '',
        type: query.type ?? '',
        status: query.status ?? '',
        auditStatus: query.auditStatus ?? '',
        storeId: query.storeId ?? '',
        pageNum: query.pageNum,
        pageSize: query.pageSize,
        orderByColumn: query.orderByColumn ?? '',
        isAsc: query.isAsc ?? '',
      }),
    )
    .digest('hex')
    .slice(0, 24);

export const buildStoreProductListCacheKey = (input: StoreProductQueryRequestLike): string | null => {
  const pathTag = normalizeAdminStoreProductPath(input.path);
  if (!pathTag) return null;

  const tenantId = resolveRateLimitTenantId({ headers: input.headers });
  const normalizedQuery = normalizeStoreProductListQuery(input.body);
  const queryHash = buildStoreProductListQueryDigest(normalizedQuery);

  return `${STORE_PRODUCT_LIST_CACHE_PREFIX}${tenantId}:${pathTag}:${queryHash}`;
};

export const buildStoreProductListStaleCacheKey = (cacheKey: string): string => `${cacheKey}:stale`;

export const buildStoreProductListTenantSnapshotCacheKey = (input: StoreProductQueryRequestLike): string | null => {
  const pathTag = normalizeAdminStoreProductPath(input.path);
  if (!pathTag) return null;

  const tenantId = resolveRateLimitTenantId({ headers: input.headers });
  return `${STORE_PRODUCT_LIST_SNAPSHOT_PREFIX}${tenantId}:${pathTag}`;
};

// 兼容旧调用方命名：兜底键默认读取 list 主键对应的 stale 缓存。
export const buildStoreProductListFallbackKey = (input: StoreProductQueryRequestLike): string | null => {
  const cacheKey = buildStoreProductListCacheKey(input);
  return cacheKey ? buildStoreProductListStaleCacheKey(cacheKey) : null;
};
