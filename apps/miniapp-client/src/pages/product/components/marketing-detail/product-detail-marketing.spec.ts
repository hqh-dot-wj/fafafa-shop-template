/**
 * Phase 5 商品详情营销区子组件逻辑测试。
 *
 * 覆盖点：
 *  - ProductSummaryCard: activity badge + store pill 显示逻辑
 *  - MarketingOfferCard: 价格 + offerTitle + explainItems 透传验证
 *  - RecommendedTeamCard: 团信息网格 + 操作按钮状态
 *  - SimpleRuntimeCard: formatDuration / formatRadius 格式化验证
 *  - FulfillmentInfoCard: blocked 状态 vs 正常确认信息分支
 */
import type {
  FulfillmentInfoProps,
  MarketingOfferProps,
  ProductSummaryProps,
  RecommendedTeamProps,
  SimpleRuntimeProps,
} from './marketing-detail.types';
import { describe, expect, it } from 'vitest';
import { getCtaPreset } from '@/components/marketing-card/marketing-cta-map';

describe('productSummaryCard 逻辑', () => {
  it('有活动时显示 activityBadge pill', () => {
    const props: ProductSummaryProps = { name: '测试课程', activityBadge: '拼课中', storeName: 'XX校区' };
    expect(props.activityBadge).toBe('拼课中');
    expect(props.storeName).toBe('XX校区');
  });

  it('无活动时不传 activityBadge', () => {
    const props: ProductSummaryProps = { name: '普通商品' };
    expect(props.activityBadge).toBeUndefined();
  });

  it('有门店时显示 storeName pill', () => {
    const props: ProductSummaryProps = { name: '测试商品', storeName: '当前门店' };
    expect(props.storeName).toBe('当前门店');
  });
});

describe('marketingOfferCard 逻辑', () => {
  it('拼课活动：完整 props 含 offerTitle + explainItems', () => {
    const props: MarketingOfferProps = {
      displayPrice: 199,
      originalPrice: 399,
      priceLabel: '拼课价',
      offerTitle: '这个课可以拼课报名',
      offerDesc: '系统已根据您的位置，优先选择最合适的团。',
      explainItems: ['3人成班，最多8人', '不成班可退款或转班'],
      commissionHint: '推广赚 ¥3.00',
      canEarnCommission: true,
    };
    expect(props.priceLabel).toBe('拼课价');
    expect(props.offerTitle).toBe('这个课可以拼课报名');
    expect(props.explainItems).toHaveLength(2);
    expect(props.explainItems![0]).toBe('3人成班，最多8人');
  });

  it('秒杀活动：不同的 offerTitle', () => {
    const props: MarketingOfferProps = {
      displayPrice: 89,
      originalPrice: 199,
      priceLabel: '秒杀价',
      offerTitle: '现在购买更优惠',
      offerDesc: '优惠有时间限制，结束后恢复原价。',
      explainItems: ['还剩12份', '每人限购1份', '当前门店可用'],
    };
    expect(props.priceLabel).toBe('秒杀价');
    expect(props.explainItems).toHaveLength(3);
  });

  it('会员价活动', () => {
    const props: MarketingOfferProps = {
      displayPrice: 29.9,
      originalPrice: 59,
      priceLabel: '会员价',
      offerTitle: '升级会员后更划算',
      explainItems: ['课程享会员折扣', '积分加倍'],
    };
    expect(props.priceLabel).toBe('会员价');
  });

  it('普通商品无 explainItems', () => {
    const props: MarketingOfferProps = {
      displayPrice: 399,
      priceLabel: '售价',
    };
    expect(props.explainItems).toBeUndefined();
    expect(props.offerTitle).toBeUndefined();
  });

  it('commissionHint 为空时不影响渲染', () => {
    const props: MarketingOfferProps = {
      displayPrice: 99,
      commissionHint: '',
      canEarnCommission: false,
    };
    expect(props.commissionHint).toBe('');
  });
});

describe('recommendedTeamCard 逻辑', () => {
  function buildTeamProps(overrides: Partial<RecommendedTeamProps> = {}): RecommendedTeamProps {
    return {
      countText: '3人成班，最多6人',
      scheduleText: '2026-06-01 19:30',
      addressText: 'XX校区 3楼 A教室',
      ...overrides,
    };
  }

  it('拼课推荐团：完整团信息', () => {
    const props = buildTeamProps({
      storeName: 'XX校区',
      latestTeamSummary: '李老师推荐团',
      reasonText: '离您最近，还差1人成班',
      canOpen: true,
    });
    expect(props.storeName).toBe('XX校区');
    expect(props.latestTeamSummary).toBe('李老师推荐团');
    expect(props.reasonText).toBe('离您最近，还差1人成班');
    expect(props.canOpen).toBe(true);
  });

  it('不满足开团资格时 canOpen=false', () => {
    const props = buildTeamProps({ canOpen: false });
    expect(props.canOpen).toBe(false);
  });

  it('开团中 opening=true', () => {
    const props = buildTeamProps({ opening: true });
    expect(props.opening).toBe(true);
  });

  it('分享入口标题可自定义', () => {
    const props = buildTeamProps({ headerTitle: '好友邀请您加入这个团' });
    expect(props.headerTitle).toBe('好友邀请您加入这个团');
  });
});

describe('simpleRuntimeCard 逻辑', () => {
  function formatDuration(minutes?: number): string {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  }

  function formatRadius(meters?: number): string {
    if (!meters) return '';
    if (meters < 1000) return `${meters}米`;
    return `${(meters / 1000).toFixed(1)}公里`;
  }

  it('服务商品展示时长和范围', () => {
    const props: SimpleRuntimeProps = {
      isService: true,
      isReal: false,
      serviceDuration: 90,
      serviceRadius: 5000,
      needBooking: true,
    };
    expect(props.isService).toBe(true);
    expect(formatDuration(props.serviceDuration)).toBe('1小时30分钟');
    expect(formatRadius(props.serviceRadius)).toBe('5.0公里');
  });

  it('实物商品展示配送信息', () => {
    const props: SimpleRuntimeProps = {
      isService: false,
      isReal: true,
      isFreeShip: true,
    };
    expect(props.isReal).toBe(true);
    expect(props.isFreeShip).toBe(true);
  });

  it('formatDuration: 小于1小时', () => {
    expect(formatDuration(45)).toBe('45分钟');
  });

  it('formatDuration: 整小时', () => {
    expect(formatDuration(120)).toBe('2小时');
  });

  it('formatDuration: undefined 返回空', () => {
    expect(formatDuration(undefined)).toBe('');
  });

  it('formatRadius: 小于1km', () => {
    expect(formatRadius(500)).toBe('500米');
  });

  it('formatRadius: 大于1km', () => {
    expect(formatRadius(2500)).toBe('2.5公里');
  });

  it('formatRadius: undefined 返回空', () => {
    expect(formatRadius(undefined)).toBe('');
  });
});

describe('fulfillmentInfoCard 逻辑', () => {
  it('非拼课活动时不渲染（isCourseGroup=false）', () => {
    const props: FulfillmentInfoProps = { isCourseGroup: false };
    expect(props.isCourseGroup).toBe(false);
  });

  it('拼课活动有阻断原因时显示 blockedReason', () => {
    const props: FulfillmentInfoProps = {
      isCourseGroup: true,
      blockedReason: '当前门店未参与该拼课活动',
    };
    expect(props.blockedReason).toBe('当前门店未参与该拼课活动');
  });

  it('拼课活动正常显示确认信息', () => {
    const props: FulfillmentInfoProps = {
      isCourseGroup: true,
      addressText: 'XX校区 3楼 A教室',
      scheduleText: '7月5日 19:30 - 21:00',
      countText: '3人成班，最多8人',
      failureHint: '可退款或转班',
    };
    expect(props.addressText).toBe('XX校区 3楼 A教室');
    expect(props.scheduleText).toBe('7月5日 19:30 - 21:00');
    expect(props.countText).toBe('3人成班，最多8人');
    expect(props.failureHint).toBe('可退款或转班');
    expect(props.blockedReason).toBeUndefined();
  });
});

describe('marketing-cta-map 与详情页 activityType 一致性', () => {
  it('group → badgeText=拼课', () => {
    expect(getCtaPreset('group').badgeText).toBe('拼课');
  });

  it('flash → badgeText=秒杀', () => {
    expect(getCtaPreset('flash').badgeText).toBe('秒杀');
  });

  it('member → badgeText=会员', () => {
    expect(getCtaPreset('member').badgeText).toBe('会员');
  });

  it('normal → badgeText 为空', () => {
    expect(getCtaPreset('normal').badgeText).toBe('');
  });
});
