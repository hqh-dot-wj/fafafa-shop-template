import { Prisma, PrismaClient } from '@prisma/client';

const TENANT_ID = '000000';

const DEFAULT_POLICIES: Array<{
  policyCode: string;
  policyName: string;
  policyType: 'SOURCE' | 'RESOLVER' | 'SORT' | 'AUDIENCE' | 'CARD_TEMPLATE';
  config: Prisma.InputJsonValue;
}> = [
  {
    policyCode: 'DEFAULT_SOURCE',
    policyName: '默认商品池',
    policyType: 'SOURCE',
    config: { mode: 'ALL_ACTIVE_PRODUCTS' },
  },
  {
    policyCode: 'DEFAULT_RESOLVER',
    policyName: '默认营销裁决',
    policyType: 'RESOLVER',
    config: { primaryOfferTypes: ['FLASH_SALE', 'COURSE_GROUP_BUY', 'NEWCOMER_EXCLUSIVE'] },
  },
  {
    policyCode: 'DEFAULT_AUDIENCE_ALL',
    policyName: '全量用户',
    policyType: 'AUDIENCE',
    config: { mode: 'ALL' },
  },
  {
    policyCode: 'NEWCOMER_AUDIENCE',
    policyName: '新人用户',
    policyType: 'AUDIENCE',
    config: { mode: 'MEMBER_TAG', includeTags: ['newcomer'] },
  },
  {
    policyCode: 'MEMBER_AUDIENCE',
    policyName: '会员用户',
    policyType: 'AUDIENCE',
    config: { mode: 'MEMBER_LEVEL', includeLevels: ['VIP', 'SVIP'] },
  },
  {
    policyCode: 'DISTRIBUTION_AUDIENCE',
    policyName: '分销用户',
    policyType: 'AUDIENCE',
    config: { mode: 'DISTRIBUTOR' },
  },
  {
    policyCode: 'SORT_RECOMMEND_WEIGHT',
    policyName: '推荐权重排序',
    policyType: 'SORT',
    config: { sortRules: [{ field: 'recommendWeight', order: 'desc' }] },
  },
  {
    policyCode: 'SORT_TIME_ASC',
    policyName: '开始时间升序',
    policyType: 'SORT',
    config: { sortRules: [{ field: 'startTime', order: 'asc' }] },
  },
  {
    policyCode: 'BANNER_CARD',
    policyName: '横幅卡片',
    policyType: 'CARD_TEMPLATE',
    config: { templateConfig: { cardStyle: 'banner', showSubtitle: true } },
  },
  {
    policyCode: 'PRODUCT_CARD',
    policyName: '商品卡片',
    policyType: 'CARD_TEMPLATE',
    config: { templateConfig: { cardStyle: 'product', showPrice: true, showTags: true } },
  },
  {
    policyCode: 'COUPON_PACK_CARD',
    policyName: '券包卡片',
    policyType: 'CARD_TEMPLATE',
    config: { templateConfig: { cardStyle: 'coupon-pack', showTags: true } },
  },
  {
    policyCode: 'FLASH_SALE_CARD',
    policyName: '秒杀卡片',
    policyType: 'CARD_TEMPLATE',
    config: { templateConfig: { cardStyle: 'flash-sale', showCountdown: true, showPrice: true } },
  },
  {
    policyCode: 'DISTRIBUTION_CARD',
    policyName: '分销卡片',
    policyType: 'CARD_TEMPLATE',
    config: { templateConfig: { cardStyle: 'distribution', showCommission: true } },
  },
];

export async function seedDefaultPolicies(prisma: PrismaClient) {
  for (const policy of DEFAULT_POLICIES) {
    await prisma.mktPolicy.upsert({
      where: { tenantId_policyCode: { tenantId: TENANT_ID, policyCode: policy.policyCode } },
      update: {
        policyName: policy.policyName,
        policyType: policy.policyType,
        config: policy.config,
        status: 'ACTIVE',
      },
      create: {
        tenantId: TENANT_ID,
        policyCode: policy.policyCode,
        policyName: policy.policyName,
        policyType: policy.policyType,
        config: policy.config,
        status: 'ACTIVE',
      },
    });
  }

  console.log('  ✓ 默认营销策略已创建');
}
