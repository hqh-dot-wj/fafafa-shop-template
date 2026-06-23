import { HttpException } from '@nestjs/common';
import { ResponseCode } from 'src/common/response';
import { ClientProductService } from './product.service';

describe('ClientProductService', () => {
  afterEach(() => {
    (ClientProductService as any).productListInflight = 0;
    jest.restoreAllMocks();
  });

  const createService = () => {
    const prisma = {
      pmsCategory: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const resolutionService = {};
    const productRepo = {};
    const cacheManager = {
      getOrSetWithLock: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
    };
    const productQueryFallbackService = {
      buildListFallbackResult: jest.fn(),
    };

    const service = new ClientProductService(
      prisma as any,
      resolutionService as any,
      productRepo as any,
      cacheManager as any,
      productQueryFallbackService as any,
    );
    return { service, cacheManager, productQueryFallbackService };
  };

  describe('normalizeListQuery', () => {
    it('Given one-char keyword, When normalize, Then ignore name filter to avoid expensive fuzzy scan', () => {
      const { service } = createService();

      const normalized = (service as any).normalizeListQuery({
        name: 'a',
        pageNum: 1,
        pageSize: 10,
      });

      expect(normalized.name).toBeUndefined();
    });

    it('Given valid keyword, When normalize, Then keep trimmed name', () => {
      const { service } = createService();

      const normalized = (service as any).normalizeListQuery({
        name: '  苹果  ',
        pageNum: 1,
        pageSize: 10,
      });

      expect(normalized.name).toBe('苹果');
    });
  });

  describe('buildProductNameFilter', () => {
    it('Given short keyword, When build name filter, Then use startsWith for cheaper index path', () => {
      const { service } = createService();
      const filter = (service as any).buildProductNameFilter('ab');
      expect(filter).toEqual({ startsWith: 'ab' });
    });

    it('Given long keyword, When build name filter, Then keep contains for recall', () => {
      const { service } = createService();
      const filter = (service as any).buildProductNameFilter('洗衣液补充装');
      expect(filter).toEqual({ contains: '洗衣液补充装' });
    });
  });

  describe('getOrLoadWithCache', () => {
    it('Given db loader fails, When stale cache exists, Then return stale payload instead of throwing', async () => {
      const { service, cacheManager } = createService();
      (cacheManager.getOrSetWithLock as jest.Mock).mockRejectedValue(new Error('redis down'));
      (cacheManager.get as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }], total: 1 });

      const loader = jest.fn().mockRejectedValue(new Error('db down'));
      const result = await (service as any).getOrLoadWithCache('client:product:list:t:abc', 300, loader);

      expect(result).toEqual({ rows: [{ id: 1 }], total: 1 });
      expect(cacheManager.get).toHaveBeenCalledWith('client:product:list:t:abc:stale');
    });

    it('Given cache returns fresh payload, When getOrLoadWithCache, Then write stale snapshot for degradation path', async () => {
      const { service, cacheManager } = createService();
      (cacheManager.getOrSetWithLock as jest.Mock).mockResolvedValue({ rows: [{ id: 2 }], total: 1 });

      const loader = jest.fn();
      const result = await (service as any).getOrLoadWithCache('client:product:list:t:def', 300, loader);

      expect(result).toEqual({ rows: [{ id: 2 }], total: 1 });
      expect(cacheManager.set).toHaveBeenCalledWith(
        'client:product:list:t:def:stale',
        { rows: [{ id: 2 }], total: 1 },
        1800000,
      );
      expect(loader).not.toHaveBeenCalled();
    });
  });

  describe('findAll overload guard', () => {
    it('Given inflight guard reached and fallback exists, When query list, Then return fallback payload', async () => {
      const { service, cacheManager, productQueryFallbackService } = createService();
      (ClientProductService as any).productListInflight = Number.MAX_SAFE_INTEGER;
      (productQueryFallbackService.buildListFallbackResult as jest.Mock).mockResolvedValue({
        code: 200,
        msg: '操作成功',
        data: {
          rows: [{ productId: 'p-1' }],
          total: 1,
          pageNum: 1,
          pageSize: 10,
          pages: 1,
        },
      });

      const result = await service.findAll({ pageNum: 1, pageSize: 10 } as any);

      expect(result).toMatchObject({
        code: 200,
        data: {
          rows: [{ productId: 'p-1' }],
          total: 1,
        },
      });
      expect(cacheManager.getOrSetWithLock).not.toHaveBeenCalled();
      expect(productQueryFallbackService.buildListFallbackResult).toHaveBeenCalledTimes(1);
    });

    it('Given inflight guard reached and no fallback, When query list, Then throw 429', async () => {
      const { service, cacheManager, productQueryFallbackService } = createService();
      (ClientProductService as any).productListInflight = Number.MAX_SAFE_INTEGER;
      (productQueryFallbackService.buildListFallbackResult as jest.Mock).mockResolvedValue(null);

      const error = await service.findAll({ pageNum: 1, pageSize: 10 } as any).catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(429);
      expect(error.getResponse()).toMatchObject({
        code: ResponseCode.TOO_MANY_REQUESTS,
      });
      expect(cacheManager.getOrSetWithLock).not.toHaveBeenCalled();
    });
  });
});
