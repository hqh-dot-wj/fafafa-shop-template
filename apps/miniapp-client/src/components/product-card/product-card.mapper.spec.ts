/**
 * Characterization 测试：锁定 product-card.mapper 在 4 种 activityType
 * （COURSE_GROUP / FLASH_SALE / MEMBER_PRICE / 无活动）下的现有渲染行为，
 * 配合 MARKETING-ZONE-CARDS-2026-05 Phase 1 保护，避免后续抽 marketing-card 组件时误改既有语义。
 *
 * 覆盖点（锁定的是当前 mapper 行为，不是 PRD 期望）：
 *  - priceLabel 优先级：tagLabel 非空 > COURSE_GROUP 兜底 '拼课价' > activityName > undefined
 *    （这层优先级在 Phase 3 marketing-cta-map.ts 设计时必须保留，否则会破坏后端配的 tagLabel 文案）
 *  - explain：COURSE_GROUP 且有 courseGroupJoinExplain.reasonText 时优先取；其他走 ruleSummary/lessonSummary/serviceSummary.label
 *  - originalPrice 仅在大于 currentPrice 时返回（避免假折扣展示）
 *  - displayTags 按 priority 降序、过滤掉无效 code/source/priority
 *  - 入口归因（entrySceneCode / entryModuleCode / entrySource）按 options + item 透传
 */
import type { ClientProduct } from '@libs/common-types';
import type { ProductCardView } from '@/api/marketing';
import type { ClientAggregateProductCard } from '@/api/product';
import { describe, expect, it } from 'vitest';
import {
  mapAggregateProductToSeniorCard,
  mapClientProductToSeniorCard,
  mapSceneProductToSeniorCard,
} from './product-card.mapper';

type AggregateInput = ClientAggregateProductCard & {
  entrySceneCode?: string;
  entryModuleCode?: string;
  entrySource?: string;
};

function buildAggregate(
  overrides: Partial<AggregateInput['mainActivity']> = {},
  extras: Partial<AggregateInput> = {},
): AggregateInput {
  const base: AggregateInput = {
    productId: 'p-001',
    productName: '八段锦养生拼课',
    productImg: 'https://cdn.test/p-001.jpg',
    mainActivity: {
      activityContextKey: 'act-001',
      activityType: 'COURSE_GROUP',
      configId: 'cfg-001',
      activityName: '李老师拼课',
      displayPrice: 199,
      originalPrice: 399,
      tagLabel: '拼课中',
      statusSummary: 'ACTIVE',
      countdownEndTime: null,
      remainingSlots: 1,
      ...overrides,
    },
    fallbackActivities: [],
    ...extras,
  };
  return base;
}

describe('product-card.mapper', () => {
  describe('mapAggregateProductToSeniorCard / 4 种活动类型', () => {
    it('cOURSE_GROUP + 空 tagLabel：priceLabel 兜底为 "拼课价"，explain 取 courseGroupJoinExplain.reasonText', () => {
      const input = buildAggregate(
        {
          activityType: 'COURSE_GROUP',
          tagLabel: '', // 后端未配 tagLabel 时，前端必须有 '拼课价' 兜底
          courseGroupJoinExplain: {
            joinable: true,
            reasonCode: 'CAN_JOIN_TEAM',
            reasonText: '离您最近，还差 1 人成班',
          },
        },
        { entrySceneCode: 'HOME_FEATURED', entryModuleCode: 'MOD_GROUP', entrySource: 'scene' },
      );

      const result = mapAggregateProductToSeniorCard(input);

      expect(result.priceLabel).toBe('拼课价');
      expect(result.currentPrice).toBe(199);
      expect(result.originalPrice).toBe(399);
      expect(result.activityType).toBe('COURSE_GROUP');
      expect(result.explain).toBe('离您最近，还差 1 人成班');
      // 入口归因透传（用于后续 marketing-card-zone 埋点）
      expect(result.entrySceneCode).toBe('HOME_FEATURED');
      expect(result.entryModuleCode).toBe('MOD_GROUP');
      expect(result.entrySource).toBe('scene');
    });

    it('tagLabel 非空时无视 activityType 兜底，优先展示后端配置文案（保留运营文案话语权）', () => {
      const input = buildAggregate({
        activityType: 'COURSE_GROUP',
        tagLabel: '拼课中', // 后端运营配的展示文案，必须优先
        courseGroupJoinExplain: {
          joinable: true,
          reasonCode: 'CAN_JOIN_TEAM',
          reasonText: '离您最近',
        },
      });

      const result = mapAggregateProductToSeniorCard(input);

      // tagLabel 优先级最高，即使 activityType=COURSE_GROUP 也不应被 '拼课价' 覆盖
      expect(result.priceLabel).toBe('拼课中');
      // explain 仍按 COURSE_GROUP 链路取 reasonText
      expect(result.explain).toBe('离您最近');
    });

    it('fLASH_SALE：priceLabel 取 tagLabel；无 courseGroupJoinExplain', () => {
      const input = buildAggregate({
        activityType: 'FLASH_SALE',
        activityName: '限时秒杀',
        tagLabel: '秒杀价',
        displayPrice: 89,
        originalPrice: 199,
        remainingSlots: 12,
      });

      const result = mapAggregateProductToSeniorCard(input);

      expect(result.activityType).toBe('FLASH_SALE');
      expect(result.priceLabel).toBe('秒杀价');
      expect(result.currentPrice).toBe(89);
      expect(result.originalPrice).toBe(199);
      // 非拼课不再读 reasonText，explain 走兜底（无 ruleSummary/lessonSummary 时为 undefined）
      expect(result.explain).toBeUndefined();
    });

    it('mEMBER_PRICE：tagLabel 缺失时退到 activityName', () => {
      const input = buildAggregate({
        activityType: 'MEMBER_PRICE',
        activityName: '黄金会员价',
        tagLabel: '',
        displayPrice: 29.9,
        originalPrice: 59,
      });

      const result = mapAggregateProductToSeniorCard(input);

      expect(result.activityType).toBe('MEMBER_PRICE');
      // resolvePriceLabel：tagLabel 为空 → 非 COURSE_GROUP → 回 activityName
      expect(result.priceLabel).toBe('黄金会员价');
      expect(result.originalPrice).toBe(59);
    });

    it('nORMAL（空 activityType + originalPrice 等于 currentPrice）：originalPrice 收敛为 undefined，避免假折扣', () => {
      const input = buildAggregate({
        activityType: '',
        activityName: '',
        tagLabel: '',
        displayPrice: 399,
        originalPrice: 399,
        remainingSlots: null,
      });

      const result = mapAggregateProductToSeniorCard(input);

      expect(result.currentPrice).toBe(399);
      // normalizeOriginalPrice：originalPrice <= currentPrice → undefined（不展示划线价）
      expect(result.originalPrice).toBeUndefined();
      // priceLabel 全部为空时 mapper 返回 undefined（CTA/标签由 marketing-cta-map 兜底）
      expect(result.priceLabel).toBeUndefined();
    });
  });

  describe('mapAggregateProductToSeniorCard / 边界与归因', () => {
    it('displayTags 按 priority 降序排列，过滤掉非法 code / 缺失字段', () => {
      const input = buildAggregate(
        {},
        {
          displayTags: [
            { code: 'NEW', label: '新品', source: 'RULE', priority: 60 },
            { code: 'STORE_RECOMMEND', label: '门店推荐', source: 'MANUAL', priority: 90 },
            // 非法 code 应被过滤
            { code: 'UNKNOWN_CODE', label: 'X', source: 'RULE', priority: 100 } as never,
            // 缺 priority 应被过滤
            { code: 'FREE_SHIPPING', label: '包邮', source: 'FACT' } as never,
          ],
        },
      );

      const result = mapAggregateProductToSeniorCard(input);

      expect(result.displayTags).toEqual([
        { code: 'STORE_RECOMMEND', label: '门店推荐', source: 'MANUAL', priority: 90 },
        { code: 'NEW', label: '新品', source: 'RULE', priority: 60 },
      ]);
    });

    it('options.sceneCode/moduleCode/entrySource 覆盖 item 自带的 entry 字段', () => {
      const input = buildAggregate(
        {},
        { entrySceneCode: 'ITEM_SCENE', entryModuleCode: 'ITEM_MOD', entrySource: 'item' },
      );

      const result = mapAggregateProductToSeniorCard(input, {
        sceneCode: 'OPT_SCENE',
        moduleCode: 'OPT_MOD',
        entrySource: 'opt',
        actionText: '去参团',
      });

      expect(result.entrySceneCode).toBe('OPT_SCENE');
      expect(result.entryModuleCode).toBe('OPT_MOD');
      expect(result.entrySource).toBe('opt');
      expect(result.actionText).toBe('去参团');
    });
  });

  describe('mapSceneProductToSeniorCard / 场景出数链路', () => {
    it('productId 缺失时返回 null（首页营销区不应渲染半个卡）', () => {
      const result = mapSceneProductToSeniorCard({ productName: '无 id 商品' } as ProductCardView);
      expect(result).toBeNull();
    });

    it('cOURSE_GROUP：priceLabel="拼课价"，currentPrice 优先 displayPrice，回退 activityPrice', () => {
      const input = {
        productId: 'p-002',
        productName: '太极养生拼课',
        productImg: 'https://cdn.test/p-002.jpg',
        primaryOffer: {
          activityContextKey: 'act-002',
          activityType: 'COURSE_GROUP',
          activityPrice: 159,
          originalPrice: 299,
          activityName: '太极拼课',
        },
      } as ProductCardView;

      const result = mapSceneProductToSeniorCard(input);

      expect(result).not.toBeNull();
      expect(result!.currentPrice).toBe(159);
      expect(result!.priceLabel).toBe('拼课价');
      expect(result!.activityType).toBe('COURSE_GROUP');
    });

    it('fLASH_SALE：使用 tagLabel 作为 priceLabel；mainActivity 优先于 primaryOffer', () => {
      const input = {
        productId: 'p-003',
        productName: '限时拳操体验',
        productImg: '',
        mainActivity: {
          activityContextKey: 'act-003',
          activityType: 'FLASH_SALE',
          displayPrice: 49,
          originalPrice: 199,
          tagLabel: '今日秒杀',
        },
        primaryOffer: {
          activityType: 'NORMAL',
          displayPrice: 999,
        },
      } as ProductCardView;

      const result = mapSceneProductToSeniorCard(input);

      expect(result!.activityType).toBe('FLASH_SALE');
      expect(result!.priceLabel).toBe('今日秒杀');
      expect(result!.currentPrice).toBe(49);
    });
  });

  describe('mapClientProductToSeniorCard / 列表/详情链路兜底', () => {
    it('无活动：priceLabel undefined，subtitle 取 categoryName，currentPrice 取 product.price', () => {
      const input = {
        productId: 'p-004',
        name: '门店体验课',
        price: 399,
        categoryName: '到店服务',
        coverImage: 'https://cdn.test/p-004.jpg',
      } as ClientProduct;

      const result = mapClientProductToSeniorCard(input);

      expect(result.currentPrice).toBe(399);
      expect(result.priceLabel).toBeUndefined();
      expect(result.subtitle).toBe('到店服务');
    });

    it('mEMBER_PRICE 来自 mainActivity：priceLabel 取 tagLabel，subTitle 优先于 categoryName', () => {
      const input = {
        productId: 'p-005',
        name: '会员体验包',
        price: 199,
        subTitle: '会员升级 9 折',
        categoryName: '体验课',
        mainActivity: {
          activityContextKey: 'act-005',
          activityType: 'MEMBER_PRICE',
          displayPrice: 99,
          originalPrice: 199,
          tagLabel: '会员特惠',
        },
      } as unknown as ClientProduct;

      const result = mapClientProductToSeniorCard(input);

      expect(result.activityType).toBe('MEMBER_PRICE');
      expect(result.priceLabel).toBe('会员特惠');
      expect(result.currentPrice).toBe(99);
      expect(result.originalPrice).toBe(199);
      expect(result.subtitle).toBe('会员升级 9 折');
    });
  });
});
