import { ProductCardViewBuilder } from './product-card-view.builder';
import type { ResolvedProduct } from './primary-offer-resolver.service';

describe('ProductCardViewBuilder', () => {
  it('passes product display projection separately from the primary marketing offer', () => {
    const builder = new ProductCardViewBuilder();
    const result = builder.buildModuleView(
      {
        moduleCode: 'HOME_HOT',
        moduleName: '精选活动',
        moduleType: 'PRODUCT_GRID',
      },
      [
        {
          productId: 'p1',
          productName: '上门保洁',
          productImg: 'https://example.com/p1.png',
          productImages: ['https://example.com/p1.png'],
          productType: 'SERVICE',
          isFreeShip: true,
          needBooking: true,
          serviceDuration: 60,
          serviceRadius: 5000,
          tenantProductCreateTime: new Date(),
          tenantProductIsHot: true,
          primaryOffer: {
            activityContextKey: 'COURSE_GROUP:cfg1',
            activityType: 'COURSE_GROUP',
            tagLabel: '拼课价',
          },
          activityCandidates: [],
        } satisfies ResolvedProduct,
      ],
    );

    const card = result.products[0];
    expect(card.primaryOffer?.tagLabel).toBe('拼课价');
    expect(card.displayTags?.map((item) => item.code)).toEqual([
      'NEW',
      'STORE_RECOMMEND',
      'SERVICE_HOME',
    ]);
    expect(card.purchaseStatus?.code).toBe('BOOKING_REQUIRED');
    expect(card.serviceSummary?.label).toBe('服务商品，需预约');
  });
});
