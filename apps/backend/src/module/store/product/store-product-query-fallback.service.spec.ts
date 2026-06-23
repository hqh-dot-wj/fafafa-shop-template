import { StoreProductQueryFallbackService } from './store-product-query-fallback.service';
import {
  buildStoreProductListCacheKey,
  buildStoreProductListStaleCacheKey,
  buildStoreProductListTenantSnapshotCacheKey,
} from './store-product-query-fallback.util';

describe('StoreProductQueryFallbackService', () => {
  const createService = () => {
    const cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
      getOrSetWithLock: jest.fn(),
    };
    const service = new StoreProductQueryFallbackService(cacheManager as any);
    return { service, cacheManager };
  };

  it('Given exact stale cache exists, When fallback requested, Then return exact cache payload', async () => {
    const { service, cacheManager } = createService();
    const input = {
      headers: { 'tenant-id': '100001' },
      body: { name: '保洁', pageNum: 1, pageSize: 20 },
      path: '/store/product/list',
    };
    const cacheKey = buildStoreProductListCacheKey(input);
    expect(cacheKey).toBeTruthy();
    const staleKey = buildStoreProductListStaleCacheKey(cacheKey!);

    (cacheManager.get as jest.Mock).mockImplementation(async (key: string) => {
      if (key === staleKey) {
        return { rows: [{ id: 'p-1' }], total: 1 };
      }
      return null;
    });

    const result = await service.buildListFallbackResult(input);

    expect(result?.code).toBe(200);
    expect(result?.data?.rows).toEqual([{ id: 'p-1' }]);
    expect(result?.data?.total).toBe(1);
  });

  it('Given exact stale miss but relaxed stale exists, When fallback requested, Then return relaxed payload', async () => {
    const { service, cacheManager } = createService();
    const input = {
      headers: { 'tenant-id': '100001' },
      body: { name: '几乎不可能命中关键词', pageNum: 1, pageSize: 20 },
      path: '/store/product/list',
    };

    const exactStaleKey = buildStoreProductListStaleCacheKey(buildStoreProductListCacheKey(input)!);
    const relaxedStaleKey = buildStoreProductListStaleCacheKey(
      buildStoreProductListCacheKey({
        ...input,
        body: { pageNum: 1, pageSize: 20 },
      })!,
    );

    (cacheManager.get as jest.Mock).mockImplementation(async (key: string) => {
      if (key === exactStaleKey) return null;
      if (key === relaxedStaleKey) {
        return { rows: [{ id: 'fallback-1' }], total: 10 };
      }
      return null;
    });

    const result = await service.buildListFallbackResult(input);

    expect(result?.code).toBe(200);
    expect(result?.data?.rows).toEqual([{ id: 'fallback-1' }]);
    expect(result?.data?.total).toBe(10);
  });

  it('Given stale caches all miss but snapshot exists, When fallback requested, Then return snapshot payload', async () => {
    const { service, cacheManager } = createService();
    const input = {
      headers: { 'tenant-id': '100001' },
      body: { name: '不存在关键词', pageNum: 2, pageSize: 20 },
      path: '/store/product/review/list',
    };
    const snapshotKey = buildStoreProductListTenantSnapshotCacheKey(input);
    expect(snapshotKey).toBeTruthy();

    (cacheManager.get as jest.Mock).mockImplementation(async (key: string) => {
      if (key === snapshotKey) {
        return { rows: [{ id: 'snapshot-1' }], total: 999 };
      }
      return null;
    });

    const result = await service.buildListFallbackResult(input);

    expect(result?.code).toBe(200);
    expect(result?.data?.rows).toEqual([{ id: 'snapshot-1' }]);
    expect(result?.data?.total).toBe(999);
  });
});
