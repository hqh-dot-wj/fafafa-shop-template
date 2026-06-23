import { describe, expect, it } from 'vitest';
import {
  buildCouponTemplateSelection,
  buildMemberSelection,
  buildPointsTaskSelection,
  buildProductSelection,
  buildTenantSelection,
} from './entity-picker.shared';

describe('entity-picker.shared', () => {
  it('prefers nickname as member display name', () => {
    expect(
      buildMemberSelection({
        memberId: 'm-1',
        nickname: 'Alice',
        mobile: '13800000000',
        levelName: 'Gold',
      }),
    ).toMatchObject({
      memberId: 'm-1',
      displayName: 'Alice',
      mobile: '13800000000',
      levelName: 'Gold',
    });
  });

  it('falls back to mobile or member id when display name is empty', () => {
    expect(
      buildMemberSelection({
        memberId: 'm-2',
        nickname: '',
        mobile: '13900000000',
      }).displayName,
    ).toBe('13900000000');

    expect(
      buildMemberSelection({
        memberId: 'm-3',
        nickname: '',
        mobile: '',
      }).displayName,
    ).toBe('m-3');
  });

  it('prefers company name as tenant display name', () => {
    expect(
      buildTenantSelection({
        tenantId: 't-1',
        companyName: 'Soybean Demo',
        contactUserName: 'Alice',
        contactPhone: '13800000000',
      }),
    ).toMatchObject({
      tenantId: 't-1',
      displayName: 'Soybean Demo',
      companyName: 'Soybean Demo',
      contactUserName: 'Alice',
      contactPhone: '13800000000',
    });
  });

  it('builds a product-level selection', () => {
    expect(
      buildProductSelection({
        productId: 'p-1',
        name: 'Detail Wash',
        type: 'SERVICE',
        price: 99,
      }),
    ).toMatchObject({
      id: 'p-1',
      productId: 'p-1',
      displayName: 'Detail Wash',
      name: 'Detail Wash',
      type: 'SERVICE',
      price: 99,
    });
  });

  it('keeps the product display name and appends sku spec info', () => {
    expect(
      buildProductSelection(
        {
          productId: 'p-2',
          name: 'Premium Wash',
          type: 'SERVICE',
          guidePrice: 199,
        },
        {
          skuId: 'sku-1',
          specValues: { duration: '60min', store: 'Flagship' },
          guidePrice: 168,
        },
      ),
    ).toMatchObject({
      id: 'sku-1',
      productId: 'p-2',
      skuId: 'sku-1',
      displayName: 'Premium Wash',
      name: 'Premium Wash - 60min / Flagship',
      specLabel: '60min / Flagship',
      price: 168,
    });
  });

  it('preserves legacy product fields for existing callers', () => {
    const globalSkus = [{ skuId: 'sku-2', specValues: { color: 'black' }, guidePrice: 88 }];
    const selection = buildProductSelection({
      productId: 'p-3',
      name: 'Legacy Product',
      subTitle: 'Legacy Preview',
      coverImage: 'cover.png',
      globalSkus,
    });

    expect(selection).toMatchObject({
      productId: 'p-3',
      productName: 'Legacy Product',
      subTitle: 'Legacy Preview',
      coverImage: 'cover.png',
      mainImages: ['cover.png'],
      globalSkus,
    });
  });

  it('builds coupon template selection with legacy amount fields', () => {
    expect(
      buildCouponTemplateSelection({
        id: 'tpl-1',
        name: '新客立减券',
        type: 'DISCOUNT',
        value: 20,
        minAmount: 100,
        status: 'ACTIVE',
        validStartTime: '2026-04-01 00:00:00',
        validEndTime: '2026-04-30 23:59:59',
      }),
    ).toMatchObject({
      id: 'tpl-1',
      templateId: 'tpl-1',
      name: '新客立减券',
      displayName: '新客立减券',
      discountAmount: 20,
      minOrderAmount: 100,
      status: 'ACTIVE',
      startTime: '2026-04-01 00:00:00',
      endTime: '2026-04-30 23:59:59',
    });
  });

  it('uses template id as fallback display name when coupon name is empty', () => {
    const selection = buildCouponTemplateSelection({
      templateId: 'tpl-2',
      name: '',
      type: 'PERCENTAGE',
      discountPercent: 85,
    });

    expect(selection).toMatchObject({
      id: 'tpl-2',
      templateId: 'tpl-2',
      displayName: 'tpl-2',
      discountPercent: 85,
    });
  });

  it('builds points task selection from task entity', () => {
    expect(
      buildPointsTaskSelection({
        id: 'task-1',
        taskKey: 'daily_signin',
        taskName: '每日签到',
        pointsReward: 10,
        isRepeatable: true,
        maxCompletions: null,
        isEnabled: true,
      }),
    ).toMatchObject({
      id: 'task-1',
      taskId: 'task-1',
      taskKey: 'daily_signin',
      taskName: '每日签到',
      displayName: '每日签到',
      pointsReward: 10,
      isRepeatable: true,
      maxCompletions: null,
      isEnabled: true,
    });
  });

  it('falls back to task key when points task name is missing', () => {
    expect(
      buildPointsTaskSelection({
        taskId: 'task-2',
        taskKey: 'order_complete',
        taskName: '',
      }),
    ).toMatchObject({
      id: 'task-2',
      taskId: 'task-2',
      taskKey: 'order_complete',
      displayName: 'order_complete',
    });
  });
});
