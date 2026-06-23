import type { ClientModuleView, ClientSceneView, ProductCardView } from '@/api/marketing';
import type { MarketingCardModel } from '@/components/marketing-card/marketing-card.types';
import { describe, expect, it } from 'vitest';
import {
  mapModuleToMarketingCards,
  mapSceneProductToMarketingCard,
} from '@/components/marketing-card/marketing-card.mapper';

const HOME_SCENE_CODE = 'HOME_FEATURED';
const HOME_SCENE_PRODUCT_LIMIT = 20;

/**
 * 与 home-aggregate-section.vue 中 transformSceneToMarketingCards 同逻辑，
 * 跨模块去重 + 限量。
 */
function transformSceneToMarketingCards(sceneView: ClientSceneView): MarketingCardModel[] {
  const dedup = new Map<string, MarketingCardModel>();
  for (const module of sceneView.modules || []) {
    const moduleCards = mapModuleToMarketingCards(module, {
      sceneCode: HOME_SCENE_CODE,
      entrySource: 'scene',
    });
    for (const card of moduleCards) {
      if (!dedup.has(card.productId)) {
        dedup.set(card.productId, card);
        if (dedup.size >= HOME_SCENE_PRODUCT_LIMIT) break;
      }
    }
    if (dedup.size >= HOME_SCENE_PRODUCT_LIMIT) break;
  }
  return [...dedup.values()];
}

function extractFeaturedCount(sceneView: Partial<ClientSceneView>): number | undefined {
  const modules = sceneView.modules;
  if (!modules || modules.length === 0) return undefined;
  const n = modules[0].uiConfig?.featuredCount;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
}

function makeProduct(id: string, activityType = 'COURSE_GROUP'): ProductCardView {
  return {
    productId: id,
    productName: `商品${id}`,
    productImg: `/img/${id}.png`,
    mainActivity: {
      activityContextKey: `ctx-${id}`,
      activityType,
      displayPrice: 99,
      originalPrice: 199,
      tagLabel: '',
      activityName: activityType === 'COURSE_GROUP' ? '拼课' : '活动',
    },
  } as unknown as ProductCardView;
}

function makeModule(code: string, products: ProductCardView[], uiConfig?: Record<string, unknown>): ClientModuleView {
  return {
    moduleCode: code,
    moduleName: `模块${code}`,
    moduleType: 'PRODUCT_LIST',
    products,
    ...(uiConfig ? { uiConfig } : {}),
  } as ClientModuleView;
}

function makeScene(modules: ClientModuleView[]): ClientSceneView {
  return { sceneCode: HOME_SCENE_CODE, modules } as ClientSceneView;
}

describe('home aggregate section integration', () => {
  describe('transformSceneToMarketingCards', () => {
    it('deduplicates products across modules by productId', () => {
      const scene = makeScene([
        makeModule('M1', [makeProduct('p1'), makeProduct('p2')]),
        makeModule('M2', [makeProduct('p2'), makeProduct('p3')]),
      ]);
      const cards = transformSceneToMarketingCards(scene);
      expect(cards.map((c) => c.productId)).toEqual(['p1', 'p2', 'p3']);
    });

    it('limits total cards to HOME_SCENE_PRODUCT_LIMIT', () => {
      const products = Array.from({ length: 25 }, (_, i) => makeProduct(`p${i}`, 'FLASH_SALE'));
      const scene = makeScene([makeModule('M1', products)]);
      const cards = transformSceneToMarketingCards(scene);
      expect(cards).toHaveLength(HOME_SCENE_PRODUCT_LIMIT);
    });

    it('preserves scene code and entry source in mapped cards', () => {
      const scene = makeScene([makeModule('M1', [makeProduct('p1')])]);
      const cards = transformSceneToMarketingCards(scene);
      expect(cards[0].entrySceneCode).toBe(HOME_SCENE_CODE);
      expect(cards[0].entrySource).toBe('scene');
    });

    it('passes module code through to each card', () => {
      const scene = makeScene([makeModule('ZONE_A', [makeProduct('p1')]), makeModule('ZONE_B', [makeProduct('p2')])]);
      const cards = transformSceneToMarketingCards(scene);
      expect(cards[0].entryModuleCode).toBe('ZONE_A');
      expect(cards[1].entryModuleCode).toBe('ZONE_B');
    });

    it('handles empty modules gracefully', () => {
      expect(transformSceneToMarketingCards(makeScene([]))).toEqual([]);
    });

    it('handles modules with empty products', () => {
      const scene = makeScene([makeModule('M1', [])]);
      expect(transformSceneToMarketingCards(scene)).toEqual([]);
    });
  });

  describe('fallback aggregate conversion', () => {
    it('converts aggregate-shaped data to marketing card via mapper', () => {
      const aggregateItem = {
        productId: 'agg1',
        productName: '聚合商品',
        productImg: '/img/agg.png',
        mainActivity: {
          activityContextKey: 'ctx-agg',
          activityType: 'FLASH_SALE',
          displayPrice: 49,
          originalPrice: 99,
          tagLabel: '秒杀价',
          activityName: '限时秒杀',
          configId: 'cfg-1',
          statusSummary: 'ACTIVE',
          countdownEndTime: null,
          remainingSlots: null,
        },
        fallbackActivities: [],
      };
      const card = mapSceneProductToMarketingCard(aggregateItem as unknown as ProductCardView, {
        sceneCode: HOME_SCENE_CODE,
        moduleCode: 'AGGREGATE_FALLBACK',
        entrySource: 'aggregate',
      });
      expect(card).not.toBeNull();
      expect(card!.productId).toBe('agg1');
      expect(card!.activityKind).toBe('flash');
      expect(card!.priceLabel).toBe('秒杀价');
      expect(card!.entrySource).toBe('aggregate');
      expect(card!.entryModuleCode).toBe('AGGREGATE_FALLBACK');
    });

    it('handles aggregate card with course group activity', () => {
      const aggregateItem = {
        productId: 'agg2',
        productName: '拼课商品',
        productImg: '/img/agg2.png',
        mainActivity: {
          activityContextKey: 'ctx-grp',
          activityType: 'COURSE_GROUP',
          displayPrice: 29,
          originalPrice: 59,
          tagLabel: '',
          activityName: '拼课',
          configId: 'cfg-2',
          statusSummary: 'ACTIVE',
          countdownEndTime: null,
          remainingSlots: 3,
        },
        fallbackActivities: [],
      };
      const card = mapSceneProductToMarketingCard(aggregateItem as unknown as ProductCardView, {
        entrySource: 'aggregate',
      });
      expect(card).not.toBeNull();
      expect(card!.activityKind).toBe('group');
      expect(card!.priceLabel).toBe('拼课价');
    });

    it('skips aggregate cards without productId', () => {
      const broken = { productName: '缺失ID' } as unknown as ProductCardView;
      const card = mapSceneProductToMarketingCard(broken, {});
      expect(card).toBeNull();
    });
  });

  describe('featured count extraction', () => {
    it('reads featuredCount from first module uiConfig', () => {
      const scene = makeScene([makeModule('M1', [], { featuredCount: 5 })]);
      expect(extractFeaturedCount(scene)).toBe(5);
    });

    it('returns undefined when modules are empty', () => {
      expect(extractFeaturedCount(makeScene([]))).toBeUndefined();
    });

    it('returns undefined when uiConfig is missing', () => {
      const scene = makeScene([makeModule('M1', [])]);
      expect(extractFeaturedCount(scene)).toBeUndefined();
    });

    it('returns undefined for non-number featuredCount', () => {
      const scene = makeScene([makeModule('M1', [], { featuredCount: 'three' })]);
      expect(extractFeaturedCount(scene)).toBeUndefined();
    });

    it('accepts zero as valid featuredCount (all cards use split)', () => {
      const scene = makeScene([makeModule('M1', [], { featuredCount: 0 })]);
      expect(extractFeaturedCount(scene)).toBe(0);
    });

    it('rejects negative featuredCount', () => {
      const scene = makeScene([makeModule('M1', [], { featuredCount: -1 })]);
      expect(extractFeaturedCount(scene)).toBeUndefined();
    });

    it('ignores second module when first has valid uiConfig', () => {
      const scene = makeScene([
        makeModule('M1', [], { featuredCount: 2 }),
        makeModule('M2', [], { featuredCount: 10 }),
      ]);
      expect(extractFeaturedCount(scene)).toBe(2);
    });
  });

  describe('course group detection', () => {
    it('identifies course group cards by activityKind', () => {
      const scene = makeScene([makeModule('M1', [makeProduct('p1', 'COURSE_GROUP'), makeProduct('p2', 'FLASH_SALE')])]);
      const cards = transformSceneToMarketingCards(scene);
      const hasGroup = cards.some((c) => c.activityKind === 'group');
      expect(hasGroup).toBe(true);
      expect(cards.filter((c) => c.activityKind === 'group')).toHaveLength(1);
    });

    it('detects COURSE_GROUP_BUY alias as group kind', () => {
      const scene = makeScene([makeModule('M1', [makeProduct('p1', 'COURSE_GROUP_BUY')])]);
      const cards = transformSceneToMarketingCards(scene);
      expect(cards[0].activityKind).toBe('group');
    });

    it('returns false when no course group cards exist', () => {
      const scene = makeScene([makeModule('M1', [makeProduct('p1', 'FLASH_SALE'), makeProduct('p2', 'MEMBER_PRICE')])]);
      const cards = transformSceneToMarketingCards(scene);
      expect(cards.some((c) => c.activityKind === 'group')).toBe(false);
    });
  });

  describe('activity kind mapping', () => {
    it('maps FLASH_SALE to flash', () => {
      const scene = makeScene([makeModule('M1', [makeProduct('p1', 'FLASH_SALE')])]);
      const cards = transformSceneToMarketingCards(scene);
      expect(cards[0].activityKind).toBe('flash');
    });

    it('maps MEMBER_PRICE to member', () => {
      const scene = makeScene([makeModule('M1', [makeProduct('p1', 'MEMBER_PRICE')])]);
      const cards = transformSceneToMarketingCards(scene);
      expect(cards[0].activityKind).toBe('member');
    });

    it('maps unknown activity type to normal', () => {
      const scene = makeScene([makeModule('M1', [makeProduct('p1', 'NEWCOMER')])]);
      const cards = transformSceneToMarketingCards(scene);
      expect(cards[0].activityKind).toBe('normal');
    });
  });
});
