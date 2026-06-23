import { buildProductDisplayProjection } from './product-display-projection.util';

describe('buildProductDisplayProjection', () => {
  const now = new Date('2026-05-03T00:00:00.000Z');

  it('builds stable product tags from tenant product facts without using marketing labels', () => {
    const projection = buildProductDisplayProjection({
      productType: 'SERVICE',
      isFreeShip: true,
      needBooking: true,
      serviceDuration: 60,
      serviceRadius: 5000,
      tenantProductCreateTime: new Date('2026-04-25T00:00:00.000Z'),
      tenantProductIsHot: true,
      now,
    });

    expect(projection.displayTags.map((item) => item.code)).toEqual([
      'NEW',
      'STORE_RECOMMEND',
      'SERVICE_HOME',
    ]);
    expect(projection.displayTags).toHaveLength(3);
    expect(projection.purchaseStatus).toEqual({
      code: 'BOOKING_REQUIRED',
      label: '需预约',
      purchasable: true,
    });
    expect(projection.serviceSummary).toEqual({
      label: '服务商品，需预约',
      needBooking: true,
      serviceDuration: 60,
      serviceRadius: 5000,
    });
  });

  it('does not mark old tenant products as new and keeps physical goods normally purchasable', () => {
    const projection = buildProductDisplayProjection({
      productType: 'REAL',
      isFreeShip: true,
      tenantProductCreateTime: new Date('2026-04-01T00:00:00.000Z'),
      tenantProductIsHot: false,
      now,
    });

    expect(projection.displayTags).toEqual([
      { code: 'FREE_SHIPPING', label: '包邮', source: 'FACT', priority: 70 },
    ]);
    expect(projection.purchaseStatus).toEqual({
      code: 'NORMAL',
      label: '可购买',
      purchasable: true,
    });
    expect(projection.serviceSummary).toBeUndefined();
  });
});
