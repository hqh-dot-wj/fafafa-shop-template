import { Injectable, Logger } from '@nestjs/common';
import { Result } from 'src/common/response';
import { CacheManagerService } from 'src/module/common/redis/cache-manager.service';
import {
  NormalizedProductListQuery,
  ProductListCachePayload,
  buildProductListCacheKey,
  buildProductListStaleCacheKey,
  buildProductListTenantSnapshotCacheKey,
  normalizeProductListQuery,
  resolveTenantIdForProductQuery,
} from './product-query-cache.util';

type ProductQueryInput = {
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

@Injectable()
export class ProductQueryFallbackService {
  private readonly logger = new Logger(ProductQueryFallbackService.name);

  constructor(private readonly cacheManager: CacheManagerService) {}

  private createFallbackCandidates(query: NormalizedProductListQuery): NormalizedProductListQuery[] {
    const candidates: NormalizedProductListQuery[] = [query];
    const addCandidate = (candidate: NormalizedProductListQuery) => {
      const duplicated = candidates.some(
        (item) =>
          item.name === candidate.name &&
          item.categoryId === candidate.categoryId &&
          item.type === candidate.type &&
          item.pageNum === candidate.pageNum &&
          item.pageSize === candidate.pageSize,
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
        skip: 0,
        take: query.pageSize,
      });
    }
    if (query.name && query.pageNum > 1) {
      addCandidate({
        ...query,
        name: undefined,
        pageNum: 1,
        skip: 0,
        take: query.pageSize,
      });
    }

    return candidates;
  }

  async buildListFallbackResult(input: ProductQueryInput): Promise<Result | null> {
    const query = normalizeProductListQuery(input.query ?? {});
    const tenantId = resolveTenantIdForProductQuery(input);
    const candidates = this.createFallbackCandidates(query);

    for (const candidate of candidates) {
      const cacheKey = buildProductListCacheKey(tenantId, candidate);
      const staleCacheKey = buildProductListStaleCacheKey(cacheKey);

      try {
        const stale = await this.cacheManager.get<ProductListCachePayload>(staleCacheKey);
        if (!stale || !Array.isArray(stale.rows) || typeof stale.total !== 'number') {
          continue;
        }
        return Result.page(stale.rows, stale.total, query.pageNum, query.pageSize);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`读取商品陈旧缓存失败: key=${staleCacheKey}, error=${message}`);
        continue;
      }
    }

    const snapshotKey = buildProductListTenantSnapshotCacheKey(tenantId);
    try {
      const snapshot = await this.cacheManager.get<ProductListCachePayload>(snapshotKey);
      if (snapshot && Array.isArray(snapshot.rows) && typeof snapshot.total === 'number') {
        return Result.page(snapshot.rows, snapshot.total, query.pageNum, query.pageSize);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`读取租户商品快照缓存失败: key=${snapshotKey}, error=${message}`);
    }

    return null;
  }
}
