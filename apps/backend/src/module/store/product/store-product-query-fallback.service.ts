import { Injectable, Logger } from '@nestjs/common';
import { Result } from 'src/common/response';
import { CacheManagerService } from 'src/module/common/redis/cache-manager.service';
import {
  buildStoreProductListCacheKey,
  buildStoreProductListStaleCacheKey,
  buildStoreProductListTenantSnapshotCacheKey,
  NormalizedStoreProductListQuery,
  normalizeStoreProductListQuery,
  StoreProductQueryRequestLike,
} from './store-product-query-fallback.util';

type FallbackInput = StoreProductQueryRequestLike;

type StoreProductListCachePayload = {
  rows: unknown[];
  total: number;
};

const parseBoolean = (raw: string | undefined, fallback: boolean): boolean => {
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const parseIntWithBounds = (raw: string | undefined, fallback: number, min: number, max: number): number => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.trunc(parsed);
  if (normalized < min) return min;
  if (normalized > max) return max;
  return normalized;
};

@Injectable()
export class StoreProductQueryFallbackService {
  private readonly logger = new Logger(StoreProductQueryFallbackService.name);
  private readonly l1Cache = new Map<string, { value: Result; expiresAt: number }>();

  private readonly fallbackEnabled = parseBoolean(
    process.env.ADMIN_STORE_PRODUCT_LIST_RATE_LIMIT_FALLBACK_ENABLED,
    true,
  );
  private readonly queryCacheEnabled = parseBoolean(process.env.ADMIN_STORE_PRODUCT_LIST_QUERY_CACHE_ENABLED, true);
  private readonly queryCacheTtlSeconds = parseIntWithBounds(
    process.env.ADMIN_STORE_PRODUCT_LIST_QUERY_CACHE_TTL_SECONDS,
    60,
    5,
    3600,
  );
  private readonly staleCacheTtlSeconds = parseIntWithBounds(
    process.env.ADMIN_STORE_PRODUCT_LIST_QUERY_STALE_TTL_SECONDS,
    1800,
    30,
    86400,
  );
  private readonly l1CacheTtlMs = parseIntWithBounds(process.env.ADMIN_STORE_PRODUCT_LIST_QUERY_L1_TTL_MS, 3000, 0, 60000);
  private readonly l1CacheMaxEntries = parseIntWithBounds(
    process.env.ADMIN_STORE_PRODUCT_LIST_QUERY_L1_MAX_ENTRIES,
    2000,
    100,
    100000,
  );

  constructor(private readonly cacheManager: CacheManagerService) {}

  async getOrLoadListResult(input: FallbackInput, loader: () => Promise<Result>): Promise<Result> {
    if (!this.queryCacheEnabled) {
      const direct = await loader();
      void this.writeListFallbackResult({
        ...input,
        result: direct,
      });
      return direct;
    }

    const cacheKey = buildStoreProductListCacheKey(input);
    if (!cacheKey) {
      const direct = await loader();
      void this.writeListFallbackResult({
        ...input,
        result: direct,
      });
      return direct;
    }

    const now = Date.now();
    const l1Cached = this.readL1Cache(cacheKey, now);
    if (l1Cached) {
      return l1Cached;
    }

    const loaderWithDerivedCache = async (): Promise<Result> => {
      const result = await loader();
      await this.writeDerivedFallbackCaches(input, cacheKey, result);
      return result;
    };

    try {
      const cached = await this.cacheManager.getOrSetWithLock<Result>(cacheKey, {
        fetcher: loaderWithDerivedCache,
        ttl: this.queryCacheTtlSeconds,
        cacheNull: false,
      });
      if (cached !== null) {
        this.writeL1Cache(cacheKey, cached, now);
        return cached;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`后台商品查询主缓存读取失败，降级直查: key=${cacheKey}, error=${message}`);
    }

    try {
      const result = await loaderWithDerivedCache();
      this.writeL1Cache(cacheKey, result, now);
      return result;
    } catch (error) {
      const fallback = await this.buildListFallbackResult(input);
      if (fallback) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`后台商品查询主链路异常，返回陈旧缓存: key=${cacheKey}, error=${message}`);
        this.writeL1Cache(cacheKey, fallback, now);
        return fallback;
      }
      throw error;
    }
  }

  async buildListFallbackResult(input: FallbackInput): Promise<Result | null> {
    if (!this.fallbackEnabled) {
      return null;
    }

    const query = normalizeStoreProductListQuery(input.body ?? {});
    const candidates = this.createFallbackCandidates(query);

    for (const candidate of candidates) {
      const candidateCacheKey = buildStoreProductListCacheKey({
        ...input,
        body: candidate as unknown as Record<string, unknown>,
      });
      if (!candidateCacheKey) continue;
      const staleCacheKey = buildStoreProductListStaleCacheKey(candidateCacheKey);
      const payload = await this.readListPayloadByKey(staleCacheKey);
      if (payload) {
        return Result.page(payload.rows, payload.total, query.pageNum, query.pageSize);
      }
    }

    const snapshotKey = buildStoreProductListTenantSnapshotCacheKey(input);
    if (!snapshotKey) {
      return null;
    }

    const snapshot = await this.readListPayloadByKey(snapshotKey);
    if (!snapshot) {
      return null;
    }

    return Result.page(snapshot.rows, snapshot.total, query.pageNum, query.pageSize);
  }

  async writeListFallbackResult(input: FallbackInput & { result: Result }): Promise<void> {
    if (!this.fallbackEnabled) {
      return;
    }

    const cacheKey = buildStoreProductListCacheKey(input);
    if (!cacheKey) {
      return;
    }

    await this.writeDerivedFallbackCaches(input, cacheKey, input.result);
  }

  private createFallbackCandidates(query: NormalizedStoreProductListQuery): NormalizedStoreProductListQuery[] {
    const candidates: NormalizedStoreProductListQuery[] = [query];
    const addCandidate = (candidate: NormalizedStoreProductListQuery) => {
      const duplicated = candidates.some(
        (item) =>
          item.name === candidate.name &&
          item.type === candidate.type &&
          item.status === candidate.status &&
          item.auditStatus === candidate.auditStatus &&
          item.storeId === candidate.storeId &&
          item.pageNum === candidate.pageNum &&
          item.pageSize === candidate.pageSize &&
          item.orderByColumn === candidate.orderByColumn &&
          item.isAsc === candidate.isAsc,
      );
      if (!duplicated) {
        candidates.push(candidate);
      }
    };

    if (query.name) {
      addCandidate({
        ...query,
        name: undefined,
      });
    }
    if (query.pageNum > 1) {
      addCandidate({
        ...query,
        pageNum: 1,
      });
    }
    if (query.name && query.pageNum > 1) {
      addCandidate({
        ...query,
        name: undefined,
        pageNum: 1,
      });
    }

    return candidates;
  }

  private extractListPayload(result: Result): StoreProductListCachePayload | null {
    const data = result?.data as { rows?: unknown; total?: unknown } | undefined;
    if (!data || !Array.isArray(data.rows) || typeof data.total !== 'number') {
      return null;
    }
    return {
      rows: data.rows,
      total: data.total,
    };
  }

  private async writeDerivedFallbackCaches(input: FallbackInput, cacheKey: string, result: Result): Promise<void> {
    if (!this.fallbackEnabled) {
      return;
    }

    const payload = this.extractListPayload(result);
    if (!payload) {
      return;
    }

    const ttlMs = this.staleCacheTtlSeconds * 1000;
    const staleCacheKey = buildStoreProductListStaleCacheKey(cacheKey);
    const snapshotCacheKey = buildStoreProductListTenantSnapshotCacheKey(input);

    try {
      await this.cacheManager.set(staleCacheKey, payload, ttlMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`写入后台商品查询 stale 缓存失败: key=${staleCacheKey}, error=${message}`);
    }

    if (!snapshotCacheKey) {
      return;
    }

    try {
      await this.cacheManager.set(snapshotCacheKey, payload, ttlMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`写入后台商品查询快照缓存失败: key=${snapshotCacheKey}, error=${message}`);
    }
  }

  private async readListPayloadByKey(cacheKey: string): Promise<StoreProductListCachePayload | null> {
    try {
      const payload = await this.cacheManager.get<StoreProductListCachePayload>(cacheKey);
      if (!payload || !Array.isArray(payload.rows) || typeof payload.total !== 'number') {
        return null;
      }
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`读取后台商品查询兜底缓存失败: key=${cacheKey}, error=${message}`);
      return null;
    }
  }

  private readL1Cache(cacheKey: string, now: number): Result | null {
    if (this.l1CacheTtlMs <= 0) {
      return null;
    }
    const record = this.l1Cache.get(cacheKey);
    if (!record) {
      return null;
    }
    if (record.expiresAt <= now) {
      this.l1Cache.delete(cacheKey);
      return null;
    }
    return record.value;
  }

  private writeL1Cache(cacheKey: string, value: Result, now: number): void {
    if (this.l1CacheTtlMs <= 0) {
      return;
    }

    if (this.l1Cache.size >= this.l1CacheMaxEntries) {
      const earliestKey = this.l1Cache.keys().next().value;
      if (typeof earliestKey === 'string') {
        this.l1Cache.delete(earliestKey);
      }
    }

    this.l1Cache.set(cacheKey, {
      value,
      expiresAt: now + this.l1CacheTtlMs,
    });
  }
}
