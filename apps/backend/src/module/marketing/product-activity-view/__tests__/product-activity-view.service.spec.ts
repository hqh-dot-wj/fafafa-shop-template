import { DelFlag, PublishStatus } from '@prisma/client';
import { ProductActivityViewService } from '../product-activity-view.service';

describe('ProductActivityViewService', () => {
  const resolutionService = {
    resolveMainActivitiesBatch: jest.fn(),
    resolveMainActivity: jest.fn(),
    resolveSceneView: jest.fn(),
  };

  const courseGroupService = {
    getProductRuntime: jest.fn(),
  };

  const productActivityViewRepository = {
    listCategoryProducts: jest.fn(),
    findCategoryById: jest.fn(),
    listRecommendProducts: jest.fn(),
  };

  let service: ProductActivityViewService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductActivityViewService(
      resolutionService as any,
      courseGroupService as any,
      productActivityViewRepository as any,
    );
  });

  it('category cards should fail-closed when course-group runtime is unavailable', async () => {
    productActivityViewRepository.listCategoryProducts.mockResolvedValue({
      rows: [
        {
          productId: 'prod-1',
          isHot: false,
          sort: 1,
          product: {
            productId: 'prod-1',
            categoryId: 1,
            name: '拼课商品',
            mainImages: ['https://example.com/prod-1.png'],
            publishStatus: PublishStatus.ON_SHELF,
            delFlag: DelFlag.NORMAL,
          },
        },
      ],
      total: 1,
    });
    productActivityViewRepository.findCategoryById.mockResolvedValue({
      catId: 1,
      name: '演示分类',
    });
    resolutionService.resolveMainActivitiesBatch.mockResolvedValue(
      new Map([
        [
          'prod-1',
          {
            activityContextKey: 'COURSE_GROUP_BUY:cfg-1',
            activityType: 'COURSE_GROUP_BUY',
            configId: 'cfg-1',
            activityName: '拼课活动',
            activityPrice: 39.9,
            originalPrice: 59.9,
            status: 'ON_SHELF',
          },
        ],
      ]),
    );
    courseGroupService.getProductRuntime.mockRejectedValue(new Error('runtime unavailable'));

    const result = await service.getCategoryProducts({
      categoryId: 1,
      memberId: 'member-1',
      pageNum: 1,
      pageSize: 20,
    });

    expect(result.data?.rows?.[0]).toMatchObject({
      productId: 'prod-1',
      storeMatchedVisible: false,
      joinableTeamCount: 0,
      courseGroupRuntime: null,
    });
  });
});
