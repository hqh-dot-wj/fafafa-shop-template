import { ProductActivityViewService } from '../../product-activity-view/product-activity-view.service';
import { ProductPoolAdapter } from '../product-pool.adapter';

describe('ProductPoolAdapter', () => {
  let adapter: ProductPoolAdapter;
  const productActivityViewService = {
    getSceneProducts: jest.fn(),
    getCategoryProducts: jest.fn(),
    getRecommendProducts: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new ProductPoolAdapter(productActivityViewService as unknown as ProductActivityViewService);
  });

  it('should compile scene products through resolution scene view', async () => {
    const serviceRows = {
      data: {
        rows: [
          {
            sourceType: 'SCENE',
            productId: 'p-001',
            productName: '场景商品',
            productImg: 'https://example.com/p-001.png',
            activityContextKey: 'act-scene-001',
            activityType: 'DISCOUNT',
            activityConfigId: 'cfg-1',
            displayPrice: 99.0,
            originalPrice: 120.0,
            activityPrice: 99.0,
            status: 'ON_SHELF',
            tagLabel: '活动',
            sortScore: 1,
          },
        ],
        total: 1,
        pageNum: 1,
        pageSize: 20,
      },
    };

    productActivityViewService.getSceneProducts.mockResolvedValue(serviceRows);
    const result = await adapter.compile({
      poolType: 'PRODUCT',
      sourceType: 'SCENE',
      sourceKey: 'newcomer',
      memberId: 'member-1',
      pageNum: 1,
      pageSize: 20,
    });

    expect(productActivityViewService.getSceneProducts).toHaveBeenCalledTimes(1);
    expect(productActivityViewService.getSceneProducts).toHaveBeenCalledWith({
      sceneCode: 'newcomer',
      memberId: 'member-1',
      pageNum: 1,
      pageSize: 20,
    });
    expect(result.poolType).toBe('PRODUCT');
    expect(result.poolId).toBe('product-scene-newcomer');
    expect(result.preview).toEqual({ rows: serviceRows.data.rows, total: serviceRows.data.total });
    expect(result.compileTarget.owner).toBe('pms / product-activity-view / resolution');
    expect(Array.isArray(result.riskSummary)).toBe(true);
    expect(result.riskSummary.length).toBeGreaterThan(0);
  });

  it('should compile category products through repository-backed category projection', async () => {
    const serviceRows = {
      data: {
        rows: [
          {
            sourceType: 'CATEGORY',
            productId: 'p-002',
            productName: '分类商品',
            productImg: 'https://example.com/p-002.png',
            activityContextKey: '',
            activityType: 'STANDARD',
            activityConfigId: '',
            displayPrice: 88,
            originalPrice: 100,
            activityPrice: 88,
            status: 'ON_SHELF',
            tagLabel: '特价',
            sortScore: 2,
          },
        ],
        total: 3,
      },
    };

    productActivityViewService.getCategoryProducts.mockResolvedValue(serviceRows);
    const result = await adapter.compile({
      poolType: 'PRODUCT',
      sourceType: 'CATEGORY',
      sourceKey: '12',
      memberId: 'member-1',
      pageNum: 1,
      pageSize: 1,
    });

    expect(productActivityViewService.getCategoryProducts).toHaveBeenCalledTimes(1);
    expect(productActivityViewService.getCategoryProducts).toHaveBeenCalledWith({
      categoryId: 12,
      memberId: 'member-1',
      pageNum: 1,
      pageSize: 1,
    });
    expect(result.poolId).toBe('product-category-12');
    expect(result.compileTarget.runtimeArtifacts).toEqual(
      expect.arrayContaining(['category-candidate', 'activity-card', 'final-display-view']),
    );
    expect(result.preview).toEqual({ rows: serviceRows.data.rows, total: serviceRows.data.total });
    expect(Array.isArray(result.riskSummary)).toBe(true);
    expect(result.riskSummary.length).toBeGreaterThan(0);
  });

  it('should compile recommend products when sourceType is RECOMMEND', async () => {
    const serviceRows = {
      data: {
        rows: [
          {
            sourceType: 'RECOMMEND',
            productId: 'p-003',
            productName: '推荐商品',
            productImg: 'https://example.com/p-003.png',
            activityContextKey: '',
            activityType: 'STANDARD',
            activityConfigId: '',
            displayPrice: 59,
            originalPrice: 80,
            activityPrice: 59,
            status: 'ON_SHELF',
            tagLabel: '推荐',
            sortScore: 1,
          },
        ],
        total: 8,
      },
    };

    productActivityViewService.getRecommendProducts.mockResolvedValue(serviceRows);
    const result = await adapter.compile({
      poolType: 'PRODUCT',
      sourceType: 'RECOMMEND',
      memberId: 'member-1',
      pageNum: 0,
      pageSize: 0,
    });

    expect(productActivityViewService.getRecommendProducts).toHaveBeenCalledTimes(1);
    expect(productActivityViewService.getRecommendProducts).toHaveBeenCalledWith({
      memberId: 'member-1',
      onlyHot: true,
      pageNum: 1,
      pageSize: 20,
    });
    expect(result.poolId).toBe('product-recommend');
    expect(result.compileTarget.runtimeArtifacts).toEqual(
      expect.arrayContaining(['recommend-candidate', 'activity-card', 'final-display-view']),
    );
    expect(result.preview).toEqual({ rows: serviceRows.data.rows, total: serviceRows.data.total });
    expect(Array.isArray(result.riskSummary)).toBe(true);
    expect(result.riskSummary.length).toBeGreaterThan(0);
  });
});
