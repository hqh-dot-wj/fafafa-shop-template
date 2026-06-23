import { Prisma, PrismaClient } from '@prisma/client';

const TENANT_ID = '000000';
const SYS_CARD = 'SYS_DEFAULT_CARD_SIMPLE';
const SYS_RESOLVER = 'SYS_DEFAULT_RESOLVER';

export async function seedDefaultScenes(prisma: PrismaClient) {
  await prisma.mktPolicy.upsert({
    where: { tenantId_policyCode: { tenantId: TENANT_ID, policyCode: SYS_CARD } },
    update: {
      policyName: '平台默认简版卡片',
      policyType: 'CARD_TEMPLATE',
      status: 'ACTIVE',
      config: { templateConfig: { cardStyle: 'simple', showPrice: true, showTags: true } } as Prisma.InputJsonValue,
    },
    create: {
      tenantId: TENANT_ID,
      policyCode: SYS_CARD,
      policyName: '平台默认简版卡片',
      policyType: 'CARD_TEMPLATE',
      config: { templateConfig: { cardStyle: 'simple', showPrice: true, showTags: true } } as Prisma.InputJsonValue,
      status: 'ACTIVE',
    },
  });

  await prisma.mktPolicy.upsert({
    where: { tenantId_policyCode: { tenantId: TENANT_ID, policyCode: SYS_RESOLVER } },
    update: {
      policyName: '平台默认裁决策略',
      policyType: 'RESOLVER',
      status: 'ACTIVE',
      config: {
        primaryOfferTypes: ['FLASH_SALE', 'COURSE_GROUP_BUY', 'PROMOTION_PRICE', 'NEWCOMER_EXCLUSIVE'],
      } as Prisma.InputJsonValue,
    },
    create: {
      tenantId: TENANT_ID,
      policyCode: SYS_RESOLVER,
      policyName: '平台默认裁决策略',
      policyType: 'RESOLVER',
      config: {
        primaryOfferTypes: ['FLASH_SALE', 'COURSE_GROUP_BUY', 'PROMOTION_PRICE', 'NEWCOMER_EXCLUSIVE'],
      } as Prisma.InputJsonValue,
      status: 'ACTIVE',
    },
  });

  const scenes: Array<{
    sceneCode: string;
    sceneName: string;
    sceneType: string;
    channelScope: Prisma.InputJsonValue;
    pageRoute: string;
    placementConfig: Prisma.InputJsonValue;
  }> = [
    {
      sceneCode: 'HOME_FEATURED',
      sceneName: '首页精选',
      sceneType: 'HOMEPAGE',
      channelScope: ['miniapp'],
      pageRoute: '/pages/index/index',
      placementConfig: {
        activityTypeFilter: 'FLASH_SALE',
        storeMatchMode: 'CURRENT_STORE',
        sortMode: 'RECOMMEND_WEIGHT',
      },
    },
    {
      sceneCode: 'PRODUCT_DETAIL',
      sceneName: '商品详情营销',
      sceneType: 'PRODUCT_DETAIL',
      channelScope: ['miniapp'],
      pageRoute: '/pages/product/detail',
      placementConfig: {
        activityTypeFilter: 'PROMOTION_PRICE',
        storeMatchMode: 'CURRENT_STORE',
        sortMode: 'UPDATE_TIME',
      },
    },
    {
      sceneCode: 'HOME_BEST_PICKS',
      sceneName: '精品推荐',
      sceneType: 'HOMEPAGE',
      channelScope: ['miniapp'],
      pageRoute: '/pages/index/index',
      placementConfig: {
        storeMatchMode: 'CURRENT_STORE',
        sortMode: 'RECOMMEND_WEIGHT',
      },
    },
    {
      sceneCode: 'HOME_GUESS_LIKES',
      sceneName: '猜你喜欢',
      sceneType: 'HOMEPAGE',
      channelScope: ['miniapp'],
      pageRoute: '/pages/index/index',
      placementConfig: {
        storeMatchMode: 'CURRENT_STORE',
        sortMode: 'USER_PREFERENCE',
      },
    },
    {
      sceneCode: 'HOME_MEMBER_ZONE',
      sceneName: '会员专区',
      sceneType: 'HOMEPAGE',
      channelScope: ['miniapp'],
      pageRoute: '/pages/index/index',
      placementConfig: {
        activityTypeFilter: 'MEMBER_DAY',
        storeMatchMode: 'CURRENT_STORE',
        sortMode: 'RECOMMEND_WEIGHT',
      },
    },
  ];

  for (const scene of scenes) {
    await prisma.mktScene.upsert({
      where: { tenantId_sceneCode: { tenantId: TENANT_ID, sceneCode: scene.sceneCode } },
      create: {
        tenantId: TENANT_ID,
        sceneCode: scene.sceneCode,
        sceneName: scene.sceneName,
        sceneType: scene.sceneType,
        channelScope: scene.channelScope,
        pageRoute: scene.pageRoute,
        defaultCardTemplateCode: SYS_CARD,
        defaultResolverPolicyCode: SYS_RESOLVER,
        placementConfig: scene.placementConfig,
        status: 'ACTIVE',
      },
      update: {
        sceneName: scene.sceneName,
        sceneType: scene.sceneType,
        channelScope: scene.channelScope,
        pageRoute: scene.pageRoute,
        defaultCardTemplateCode: SYS_CARD,
        defaultResolverPolicyCode: SYS_RESOLVER,
        placementConfig: scene.placementConfig,
        status: 'ACTIVE',
      },
    });
  }

  console.log('  ✓ 默认营销场景已创建');
}
