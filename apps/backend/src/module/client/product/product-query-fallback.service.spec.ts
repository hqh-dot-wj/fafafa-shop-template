import { ProductQueryFallbackService } from './product-query-fallback.service';
import {
  buildProductListCacheKey,
  buildProductListStaleCacheKey,
  buildProductListTenantSnapshotCacheKey,
  normalizeProductListQuery,
} from './product-query-cache.util';

describe('ProductQueryFallbackService', () => {
  const createService = () => {
    const cacheManager = {
      get: jest.fn(),
    };
    const service = new ProductQueryFallbackService(cacheManager as any);
    return { service, cacheManager };
  };

  it('Given exact stale cache exists, When fallback requested, Then return exact cache payload', async () => {
    const { service, cacheManager } = createService();
    const tenantId = '100001';
    const query = { name: '保洁', pageNum: 1, pageSize: 10 };
    const normalized = normalizeProductListQuery(query as any);
    const staleKey = buildProductListStaleCacheKey(buildProductListCacheKey(tenantId, normalized));

    (cacheManager.get as jest.Mock).mockImplementation(async (key: string) => {
      if (key === staleKey) {
        return { rows: [{ productId: 'p-1' }], total: 1 };
      }
      return null;
    });

    const result = await service.buildListFallbackResult({
      headers: { 'tenant-id': tenantId },
      query: query as any,
    });

    expect(result?.code).toBe(200);
    expect(result?.data?.rows).toEqual([{ productId: 'p-1' }]);
    expect(result?.data?.total).toBe(1);
  });

  it('Given exact cache missed but relaxed cache exists, When fallback requested, Then return relaxed payload', async () => {
    const { service, cacheManager } = createService();
    const tenantId = '100001';
    const query = { name: '几乎不可能命中关键词', pageNum: 1, pageSize: 10 };
    const exactNormalized = normalizeProductListQuery(query as any);
    const relaxedNormalized = normalizeProductListQuery({ pageNum: 1, pageSize: 10 } as any);

    const exactStaleKey = buildProductListStaleCacheKey(buildProductListCacheKey(tenantId, exactNormalized));
    const relaxedStaleKey = buildProductListStaleCacheKey(buildProductListCacheKey(tenantId, relaxedNormalized));

    (cacheManager.get as jest.Mock).mockImplementation(async (key: string) => {
      if (key === exactStaleKey) return null;
      if (key === relaxedStaleKey) {
        return { rows: [{ productId: 'fallback-1' }], total: 10 };
      }
      return null;
    });

    const result = await service.buildListFallbackResult({
      headers: { 'tenant-id': tenantId },
      query: query as any,
    });

    expect(result?.code).toBe(200);
    expect(result?.data?.rows).toEqual([{ productId: 'fallback-1' }]);
    expect(result?.data?.total).toBe(10);
  });

  it('Given stale caches all miss but tenant snapshot exists, When fallback requested, Then return tenant snapshot payload', async () => {
    const { service, cacheManager } = createService();
    const tenantId = '100001';
    const query = { name: '不存在关键词', pageNum: 2, pageSize: 10 };
    const snapshotKey = buildProductListTenantSnapshotCacheKey(tenantId);

    (cacheManager.get as jest.Mock).mockImplementation(async (key: string) => {
      if (key === snapshotKey) {
        return { rows: [{ productId: 'snapshot-1' }], total: 999 };
      }
      return null;
    });

    const result = await service.buildListFallbackResult({
      headers: { 'tenant-id': tenantId },
      query: query as any,
    });

    expect(result?.code).toBe(200);
    expect(result?.data?.rows).toEqual([{ productId: 'snapshot-1' }]);
    expect(result?.data?.total).toBe(999);
  });
});
