import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useMarketingDisplay } from './useMarketingDisplay';

describe('useMarketingDisplay', () => {
  it('优先使用 mainActivity.displayPrice', () => {
    const product = ref({
      price: 199,
      mainActivity: {
        activityContextKey: 'act-main',
        activityType: 'COURSE_GROUP',
        configId: 'cfg-main',
        activityName: '课程拼课',
        displayPrice: 88,
      },
      marketingView: {
        priceView: {
          salePrice: 99,
          originalPrice: 199,
        },
      },
    });
    const selectedSku = ref({ skuId: 'sku-1', price: 109 });

    const { displayPrice, activityLabel, activeActivity } = useMarketingDisplay(product, selectedSku);

    expect(activeActivity.value?.activityContextKey).toBe('act-main');
    expect(displayPrice.value).toBe(88);
    expect(activityLabel.value).toBe('拼课价');
  });

  it('mainActivity 缺失时回退读取 mainActivitySummary', () => {
    const product = ref({
      price: 299,
      mainActivitySummary: {
        activityContextKey: 'act-summary',
        activityType: 'COURSE_GROUP',
        configId: 'cfg-summary',
        activityName: '周末拼课',
        displayPrice: 159,
        originalPrice: 299,
      },
    });
    const selectedSku = ref<{ skuId: string; price: number } | null>(null);

    const { displayPrice, originalPrice, activeActivity } = useMarketingDisplay(product as never, selectedSku);

    expect(activeActivity.value?.activityContextKey).toBe('act-summary');
    expect(displayPrice.value).toBe(159);
    expect(originalPrice.value).toBe(299);
  });

  it('兜底读取 primaryOffer', () => {
    const product = ref({
      price: 399,
      marketingView: {
        primaryOffer: {
          activityContextKey: 'act-offer',
          activityType: 'FLASH_SALE',
          configId: 'cfg-offer',
          activityName: '多人拼团',
          displayPrice: 219,
        },
      },
    });
    const selectedSku = ref<{ skuId: string; price: number } | null>(null);

    const { displayPrice, activeActivity } = useMarketingDisplay(product, selectedSku);

    expect(activeActivity.value?.activityContextKey).toBe('act-offer');
    expect(displayPrice.value).toBe(219);
  });

  it('有 skuPrices 时切换 SKU 会更新活动价与参与态', () => {
    const product = ref({
      price: 36.9,
      skus: [
        { skuId: 'sku-a', price: 36.9 },
        { skuId: 'sku-b', price: 68 },
      ],
      mainActivity: {
        activityContextKey: 'act-flash',
        activityType: 'FLASH_SALE',
        configId: 'cfg-flash',
        activityName: '椰子水秒杀',
        activityPrice: 19.9,
        rules: {
          skuPrices: {
            'sku-a': { flashPrice: 29.9, originalPrice: 36.9 },
            'sku-b': { flashPrice: 55.9, originalPrice: 68 },
          },
        },
      },
    });
    const selectedSku = ref({ skuId: 'sku-a', price: 36.9 });

    const { displayPrice, selectedSkuInActivity, activityLabel } = useMarketingDisplay(product, selectedSku);

    expect(displayPrice.value).toBe(29.9);
    expect(selectedSkuInActivity.value).toBe(true);
    expect(activityLabel.value).toBe('秒杀价');

    selectedSku.value = { skuId: 'sku-b', price: 68 };
    expect(displayPrice.value).toBe(55.9);
    expect(selectedSkuInActivity.value).toBe(true);
  });

  it('多规格无 skuPrices 时按货架价展示且不算入活动 SKU', () => {
    const product = ref({
      price: 36.9,
      skus: [
        { skuId: 'sku-a', price: 36.9 },
        { skuId: 'sku-b', price: 68 },
      ],
      mainActivity: {
        activityContextKey: 'act-flash',
        activityType: 'FLASH_SALE',
        configId: 'cfg-flash',
        activityName: '椰子水秒杀',
        activityPrice: 19.9,
        originalPrice: 27.9,
        rules: { flashPrice: 19.9 },
      },
    });
    const selectedSku = ref({ skuId: 'sku-b', price: 68 });

    const { displayPrice, selectedSkuInActivity, activityLabel } = useMarketingDisplay(product, selectedSku);

    expect(displayPrice.value).toBe(68);
    expect(selectedSkuInActivity.value).toBe(false);
    expect(activityLabel.value).toBe('售价');
  });

  it('拼课仅有活动价/原价、无 skuPrices 时按货架价贴近原价识别参与 SKU', () => {
    const product = ref({
      price: 980,
      skus: [
        { skuId: 'tenant-sku-1', price: 899 },
        { skuId: 'tenant-sku-2', price: 1620 },
      ],
      mainActivity: {
        activityContextKey: 'act-group',
        activityType: 'COURSE_GROUP_BUY',
        configId: 'hf-config-course-art',
        activityName: '创意绘画拼课',
        activityPrice: 799,
        originalPrice: 980,
        rules: { minCount: 2, maxCount: 8 },
      },
    });
    const selectedSku = ref({ skuId: 'tenant-sku-1', price: 899 });

    const { displayPrice, selectedSkuInActivity, activityLabel } = useMarketingDisplay(product, selectedSku);

    expect(displayPrice.value).toBe(799);
    expect(selectedSkuInActivity.value).toBe(true);
    expect(activityLabel.value).toBe('拼课价');

    selectedSku.value = { skuId: 'tenant-sku-2', price: 1620 };
    expect(displayPrice.value).toBe(1620);
    expect(selectedSkuInActivity.value).toBe(false);
    expect(activityLabel.value).toBe('售价');
  });

  it('仅部分 SKU 参与拼课时未命中规格回到普通价', () => {
    const product = ref({
      price: 980,
      skus: [
        { skuId: 'sku-in', price: 799 },
        { skuId: 'sku-out', price: 980 },
      ],
      mainActivity: {
        activityContextKey: 'act-group',
        activityType: 'COURSE_GROUP',
        configId: 'cfg-group',
        activityName: '绘画拼课',
        activityPrice: 799,
        rules: {
          skuPrices: {
            'sku-in': { price: 799, originalPrice: 980 },
          },
        },
      },
    });
    const selectedSku = ref({ skuId: 'sku-out', price: 980 });

    const { displayPrice, selectedSkuInActivity, activityLabel } = useMarketingDisplay(product, selectedSku);

    expect(displayPrice.value).toBe(980);
    expect(selectedSkuInActivity.value).toBe(false);
    expect(activityLabel.value).toBe('售价');
  });
});
