import type { MarketingJsonSchema } from './json-schema';

export const CAMPAIGN_POLICY_SCHEMAS: Record<string, MarketingJsonSchema> = {
  FIRST_ORDER: {
    type: 'object',
    title: '首单优惠策略',
    required: ['discountAmount'],
    properties: {
      discountAmount: { type: 'string', title: '优惠金额', description: '金额以 Decimal 字符串保存' },
      minOrderAmount: { type: 'string', title: '订单门槛', description: '金额以 Decimal 字符串保存' },
      couponTemplateIds: { type: 'array', title: '叠加优惠券', 'ui:widget': 'CouponPicker' },
    },
  },
  FULL_REDUCTION: {
    type: 'object',
    title: '满减策略',
    required: ['minOrderAmount', 'reductionAmount'],
    properties: {
      minOrderAmount: { type: 'string', title: '满减门槛', description: '金额以 Decimal 字符串保存' },
      reductionAmount: { type: 'string', title: '减免金额', description: '金额以 Decimal 字符串保存' },
      stackable: { type: 'boolean', title: '可叠加优惠券', default: false },
    },
  },
  MEMBER_DAY: {
    type: 'object',
    title: '会员日策略',
    required: ['memberSegments'],
    properties: {
      memberSegments: { type: 'array', title: '会员人群', 'ui:widget': 'MemberFilterEditor' },
      discountPercent: { type: 'number', title: '折扣比例', minimum: 0, maximum: 100 },
      couponTemplateIds: { type: 'array', title: '会员券', 'ui:widget': 'CouponPicker' },
    },
  },
  PROMOTION_PRICE: {
    type: 'object',
    title: '促销价策略',
    required: ['products', 'promotionPrice'],
    properties: {
      products: { type: 'array', title: '参与商品', 'ui:widget': 'ProductPicker' },
      promotionPrice: { type: 'string', title: '促销价', description: '金额以 Decimal 字符串保存' },
      validTime: { type: 'array', title: '生效时间', 'ui:widget': 'TimeRangePicker' },
    },
  },
  BIRTHDAY: {
    type: 'object',
    title: '生日礼策略',
    required: ['birthdayWindowDays'],
    properties: {
      birthdayWindowDays: { type: 'integer', title: '生日窗口天数', minimum: 1 },
      couponTemplateIds: { type: 'array', title: '生日券', 'ui:widget': 'CouponPicker' },
      pointsReward: { type: 'integer', title: '生日积分', minimum: 0 },
    },
  },
};

export function getCampaignPolicySchema(type: string): MarketingJsonSchema | undefined {
  return CAMPAIGN_POLICY_SCHEMAS[type];
}
