/**
 * marketing-card 组件测试：覆盖 mapper 4 种 activityKind 映射行为 + zone featuredCount 切分逻辑。
 *
 * 覆盖点：
 *  - COURSE_GROUP / COURSE_GROUP_BUY → activityKind='group'，badgeText='拼课'，ctaText='去拼课'
 *  - FLASH_SALE → activityKind='flash'，badgeText='秒杀'，ctaText='立即抢购'
 *  - MEMBER_PRICE → activityKind='member'，badgeText='会员'，ctaText='查看详情'
 *  - 无活动 → activityKind='normal'，无 badge
 *  - priceLabel 优先级：tagLabel > '拼课价' > activityName > cta-map 兜底
 *  - featuredCount=3 时前 3 张 overlay、第 4 张起 split
 *  - cardLayout 显式指定优先于 featuredCount 位次
 *  - courseGroupJoinExplain.remainingSlots → remainingSlots + secondaryHint
 */
import type { ClientProduct } from '@libs/common-types';
import type { MarketingCardModel } from './marketing-card.types';
import type { ProductCardView } from '@/api/marketing';
import { describe, expect, it } from 'vitest';
import { mapClientProductToMarketingCard, mapSceneProductToMarketingCard } from './marketing-card.mapper';
import { getCtaPreset } from './marketing-cta-map';

function buildProduct(overrides: Partial<Record<string, unknown>> = {}): ProductCardView {
  return {
    productId: 'p1',
    productName: '测试商品',
    productImg: 'https://img.example.com/p1.jpg',
    ...overrides,
  } as ProductCardView;
}

function buildOffer(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    activityContextKey: 'ctx-1',
    activityType: 'COURSE_GROUP',
    configId: 'cfg-1',
    activityName: '拼课活动',
    displayPrice: 99,
    originalPrice: 199,
    ...overrides,
  };
}

describe('mapSceneProductToMarketingCard', () => {
  describe('activityKind = group (COURSE_GROUP)', () => {
    it('course_group → group，badge=拼课，cta=去拼课', () => {
      const product = buildProduct({ primaryOffer: buildOffer({ activityType: 'COURSE_GROUP' }) });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.activityKind).toBe('group');
      expect(result.badgeText).toBe('拼课');
      expect(result.actionText).toBe('去参团');
    });

    it('course_group_buy 也识别为 group', () => {
      const product = buildProduct({ primaryOffer: buildOffer({ activityType: 'COURSE_GROUP_BUY' }) });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.activityKind).toBe('group');
    });

    it('招募中团用 remainingToForm 驱动角标文案', () => {
      const product = buildProduct({
        primaryOffer: buildOffer({ activityType: 'COURSE_GROUP' }),
        courseGroupJoinExplain: {
          joinable: true,
          teamStatus: 'RECRUITING',
          reasonCode: 'OK',
          reasonText: '离您最近，还差1人即可成团',
          remainingSlots: 7,
          remainingToForm: 1,
          minCount: 2,
          effectiveMemberCount: 1,
        },
      });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.remainToForm).toBe(1);
      expect(result.remainingSlots).toBe(7);
      expect(result.secondaryHint).toBe('还差1人即可成团');
    });

    it('priceLabel 优先级：tagLabel > 拼课价兜底', () => {
      const product = buildProduct({
        primaryOffer: buildOffer({ activityType: 'COURSE_GROUP', tagLabel: '限量拼课' }),
      });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.priceLabel).toBe('限量拼课');
    });

    it('无 tagLabel 时 priceLabel 兜底为 "拼课价"', () => {
      const product = buildProduct({
        primaryOffer: buildOffer({ activityType: 'COURSE_GROUP', tagLabel: undefined }),
      });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.priceLabel).toBe('拼课价');
    });

    it('有活动时主标题用 activityName，不展示商品名', () => {
      const product = buildProduct({
        productName: '篮球体能训练营',
        primaryOffer: buildOffer({
          activityType: 'COURSE_GROUP',
          activityName: '篮球周末拼课',
        }),
      });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.title).toBe('篮球周末拼课');
      expect(result.priceLabel).toBe('拼课价');
    });

    it('tagLabel 与活动主标题相同时价签回退为拼课价，不重复展示', () => {
      const product = buildProduct({
        productName: '创意绘画课',
        primaryOffer: buildOffer({
          activityType: 'COURSE_GROUP',
          activityName: '创意绘画拼课',
          tagLabel: '创意绘画拼课',
        }),
      });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.title).toBe('创意绘画拼课');
      expect(result.priceLabel).toBe('拼课价');
    });
  });

  describe('activityKind = flash (FLASH_SALE)', () => {
    it('flash_sale → flash，badge=秒杀，cta=立即抢购', () => {
      const product = buildProduct({ primaryOffer: buildOffer({ activityType: 'FLASH_SALE' }) });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.activityKind).toBe('flash');
      expect(result.badgeText).toBe('秒杀');
      expect(result.actionText).toBe('立即抢购');
    });

    it('priceLabel 无 tagLabel 时用 activityName，再无则用兜底 "秒杀价"', () => {
      const product = buildProduct({
        primaryOffer: buildOffer({ activityType: 'FLASH_SALE', tagLabel: '', activityName: '' }),
      });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.priceLabel).toBe('秒杀价');
    });

    it('活动名已作主标题时价签不再重复 activityName', () => {
      const product = buildProduct({
        productName: '椰子水 1L',
        primaryOffer: buildOffer({
          activityType: 'FLASH_SALE',
          activityName: '夏日秒杀',
          tagLabel: '',
        }),
      });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.title).toBe('夏日秒杀');
      expect(result.priceLabel).toBe('秒杀价');
    });
  });

  describe('activityKind = member (MEMBER_PRICE)', () => {
    it('member_price → member，badge=会员，cta=查看详情', () => {
      const product = buildProduct({ primaryOffer: buildOffer({ activityType: 'MEMBER_PRICE' }) });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.activityKind).toBe('member');
      expect(result.badgeText).toBe('会员');
      expect(result.actionText).toBe('查看详情');
    });
  });

  describe('activityKind = normal（无活动或未知类型）', () => {
    it('无 primaryOffer → normal，无 badge', () => {
      const product = buildProduct({});
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.activityKind).toBe('normal');
      expect(result.badgeText).toBeUndefined();
      expect(result.actionText).toBe('查看详情');
    });
  });

  describe('cardLayout 透传', () => {
    it('后端指定 cardLayout=overlay 时透传', () => {
      const product = buildProduct({
        primaryOffer: buildOffer(),
        cardLayout: 'overlay',
      });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.cardLayout).toBe('overlay');
    });

    it('后端指定 cardLayout=split 时透传', () => {
      const product = buildProduct({
        primaryOffer: buildOffer(),
        cardLayout: 'split',
      });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.cardLayout).toBe('split');
    });

    it('后端未指定 cardLayout 时为 undefined', () => {
      const product = buildProduct({ primaryOffer: buildOffer() });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.cardLayout).toBeUndefined();
    });
  });

  describe('originalPrice 归一化', () => {
    it('originalPrice > currentPrice 时保留', () => {
      const product = buildProduct({ primaryOffer: buildOffer({ displayPrice: 50, originalPrice: 100 }) });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.originalPrice).toBe(100);
    });

    it('originalPrice <= currentPrice 时不展示', () => {
      const product = buildProduct({ primaryOffer: buildOffer({ displayPrice: 100, originalPrice: 100 }) });
      const result = mapSceneProductToMarketingCard(product)!;
      expect(result.originalPrice).toBeUndefined();
    });
  });

  it('productId 缺失时返回 null', () => {
    const result = mapSceneProductToMarketingCard({ productName: 'test' } as ProductCardView);
    expect(result).toBeNull();
  });
});

describe('mapClientProductToMarketingCard', () => {
  function buildClientProduct(overrides: Partial<Record<string, unknown>> = {}): ClientProduct {
    return {
      productId: 'cp-1',
      name: '分类商品',
      price: 36.9,
      coverImage: 'https://img.example.com/cp-1.jpg',
      ...overrides,
    } as ClientProduct;
  }

  it('mainActivitySummary 仅 tagLabel 时主标题用活动名（分类列表接口形态）', () => {
    const result = mapClientProductToMarketingCard(
      buildClientProduct({
        name: '少儿创意绘画启蒙',
        price: 899,
        mainActivitySummary: {
          activityContextKey: 'ctx-paint',
          activityType: 'COURSE_GROUP',
          tagLabel: '创意绘画拼课',
          displayPrice: 799,
        },
      }),
      { listDensity: 'category' },
    )!;
    expect(result.title).toBe('创意绘画拼课');
    expect(result.priceLabel).toBe('拼课价');
    expect(result.currentPrice).toBe(799);
  });

  it('无活动时回退 product.price，并固定 cardLayout=split', () => {
    const result = mapClientProductToMarketingCard(buildClientProduct())!;
    expect(result.cardLayout).toBe('split');
    expect(result.activityKind).toBe('normal');
    expect(result.title).toBe('分类商品');
    expect(result.currentPrice).toBe(36.9);
    expect(result.actionText).toBe('查看详情');
  });

  it('listDensity=category 时去掉与主标题/价签重复的 explain', () => {
    const result = mapClientProductToMarketingCard(
      buildClientProduct({
        mainActivity: {
          activityType: 'FLASH_SALE',
          activityContextKey: 'ctx-flash',
          activityName: '限时秒杀',
          tagLabel: '限时秒杀',
          activityPrice: 19.9,
          originalPrice: 27.9,
          displayPrice: 19.9,
          ruleSummary: '限时秒杀',
        },
      }),
      { listDensity: 'category' },
    )!;
    expect(result.title).toBe('限时秒杀');
    expect(result.priceLabel).toBe('秒杀价');
    expect(result.explain).toBeUndefined();
    expect(result.displayTags).toBeUndefined();
  });

  it('fLASH_SALE 识别为 flash 并使用秒杀 CTA', () => {
    const result = mapClientProductToMarketingCard(
      buildClientProduct({
        mainActivity: {
          activityType: 'FLASH_SALE',
          activityContextKey: 'ctx-flash',
          activityName: '椰子水秒杀',
          activityPrice: 19.9,
          originalPrice: 27.9,
          displayPrice: 19.9,
        },
      }),
      { entrySource: 'category' },
    )!;
    expect(result.activityKind).toBe('flash');
    expect(result.badgeText).toBe('秒杀');
    expect(result.actionText).toBe('立即抢购');
    expect(result.entrySource).toBe('category');
  });
});

describe('getCtaPreset', () => {
  it.each([
    ['group', '拼课', '拼课价', '去参团', 'group'],
    ['flash', '秒杀', '秒杀价', '立即抢购', 'buy'],
    ['member', '会员', '会员价', '查看详情', 'detail'],
    ['normal', '', '', '查看详情', 'detail'],
  ] as const)('%s → badgeText=%s, priceLabel=%s, ctaText=%s, ctaIntent=%s', (kind, badge, price, cta, intent) => {
    const preset = getCtaPreset(kind);
    expect(preset.badgeText).toBe(badge);
    expect(preset.priceLabel).toBe(price);
    expect(preset.ctaText).toBe(cta);
    expect(preset.ctaIntent).toBe(intent);
  });
});

describe('marketing-card-zone shouldOverlay 逻辑', () => {
  function shouldOverlay(card: MarketingCardModel, index: number, featuredCount = 3): boolean {
    if (card.cardLayout === 'overlay') return true;
    if (card.cardLayout === 'split') return false;
    return index < featuredCount;
  }

  function buildCard(overrides: Partial<MarketingCardModel> = {}): MarketingCardModel {
    return {
      productId: 'p1',
      title: '测试',
      imageUrl: '/img.png',
      actionText: '查看详情',
      activityKind: 'normal',
      ...overrides,
    };
  }

  it('featuredCount=3 时前 3 张 overlay、第 4 张起 split', () => {
    const cards = Array.from({ length: 5 }, (_, i) => buildCard({ productId: `p${i}` }));
    const results = cards.map((c, i) => shouldOverlay(c, i, 3));
    expect(results).toEqual([true, true, true, false, false]);
  });

  it('cardLayout=overlay 显式指定时无视 featuredCount 位次', () => {
    const card = buildCard({ cardLayout: 'overlay' });
    expect(shouldOverlay(card, 10, 3)).toBe(true);
  });

  it('cardLayout=split 显式指定时无视 featuredCount 位次', () => {
    const card = buildCard({ cardLayout: 'split' });
    expect(shouldOverlay(card, 0, 3)).toBe(false);
  });

  it('featuredCount=0 时全部为 split', () => {
    const cards = Array.from({ length: 3 }, (_, i) => buildCard({ productId: `p${i}` }));
    const results = cards.map((c, i) => shouldOverlay(c, i, 0));
    expect(results).toEqual([false, false, false]);
  });
});
