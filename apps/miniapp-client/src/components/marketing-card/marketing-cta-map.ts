import type { ActivityKind } from './marketing-card.types';

export interface CtaPreset {
  badgeText: string;
  /** 最低优先级兜底，不覆盖后端 tagLabel / activityName（见 Phase 1 关键发现） */
  priceLabel: string;
  ctaText: string;
  ctaIntent: 'group' | 'buy' | 'detail';
}

const CTA_MAP: Record<ActivityKind, CtaPreset> = {
  group: {
    badgeText: '拼课',
    priceLabel: '拼课价',
    ctaText: '去参团',
    ctaIntent: 'group',
  },
  flash: {
    badgeText: '秒杀',
    priceLabel: '秒杀价',
    ctaText: '立即抢购',
    ctaIntent: 'buy',
  },
  member: {
    badgeText: '会员',
    priceLabel: '会员价',
    ctaText: '查看详情',
    ctaIntent: 'detail',
  },
  normal: {
    badgeText: '',
    priceLabel: '',
    ctaText: '查看详情',
    ctaIntent: 'detail',
  },
};

export function getCtaPreset(kind: ActivityKind): CtaPreset {
  return CTA_MAP[kind];
}
