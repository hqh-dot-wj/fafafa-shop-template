import { describe, expect, it } from 'vitest';
import { mapGlobalSkuForSubmit } from './map-global-sku-for-submit';

describe('mapGlobalSkuForSubmit', () => {
  it('去掉 stock、skuCode、pic，保留 DTO 字段', () => {
    const row = {
      specValues: {},
      guidePrice: 1,
      guideRate: 5,
      minDistRate: 5,
      maxDistRate: 9,
      distMode: 'FIXED' as const,
      stock: 99,
      skuCode: 'x',
      pic: '',
      costPrice: 0,
    };
    expect(mapGlobalSkuForSubmit(row)).toEqual({
      specValues: {},
      guidePrice: 1,
      guideRate: 5,
      minDistRate: 5,
      maxDistRate: 9,
      distMode: 'FIXED',
      costPrice: 0,
      skuImage: undefined,
    });
  });

  it('pic 非空时映射为 skuImage', () => {
    expect(
      mapGlobalSkuForSubmit({
        specValues: {},
        guidePrice: 0,
        guideRate: 0,
        minDistRate: 0,
        maxDistRate: 0,
        distMode: 'NONE',
        pic: 'https://example.com/a.jpg',
      }),
    ).toMatchObject({ skuImage: 'https://example.com/a.jpg' });
  });
});
