import { Prisma, PrismaClient } from '@prisma/client';

type SceneTemplateSeed = {
  templateCode: string;
  templateName: string;
  sceneType: string;
  channelScope: Prisma.InputJsonValue;
  pageRoute: string;
  defaultCardTemplateCode: string;
  defaultResolverPolicyCode: string;
  placementConfig: Prisma.InputJsonValue;
  description: string;
  modules: Array<{
    moduleSlot: string;
    moduleName: string;
    moduleType: string;
    title: string;
    subTitle?: string;
    displayOrder: number;
    limitSize: number;
    sourcePolicyCode: string;
    resolverPolicyCode: string;
    sortPolicyCode?: string;
    audiencePolicyCode?: string;
    cardTemplateCode: string;
    attributionPolicyCode?: string;
    uiConfig?: Prisma.InputJsonValue;
  }>;
};

const TEMPLATES: SceneTemplateSeed[] = [
  {
    templateCode: 'HOMEPAGE_PROMOTION_FEED',
    templateName: '首页营销 Feed',
    sceneType: 'HOMEPAGE',
    channelScope: ['miniapp', 'h5'],
    pageRoute: '/pages/index/index',
    defaultCardTemplateCode: 'PRODUCT_CARD',
    defaultResolverPolicyCode: 'DEFAULT_RESOLVER',
    placementConfig: { activityTypeFilter: 'ALL', storeMatchMode: 'CURRENT_STORE', sortMode: 'RECOMMEND_WEIGHT' },
    description: '适用于首页横幅、热卖和个性推荐组合。',
    modules: [
      {
        moduleSlot: 'banner',
        moduleName: '首页横幅',
        moduleType: 'BANNER',
        title: '今日推荐',
        subTitle: '精选活动与门店权益',
        displayOrder: 10,
        limitSize: 5,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        sortPolicyCode: 'SORT_RECOMMEND_WEIGHT',
        audiencePolicyCode: 'DEFAULT_AUDIENCE_ALL',
        cardTemplateCode: 'BANNER_CARD',
        uiConfig: { layout: 'banner-carousel' },
      },
      {
        moduleSlot: 'hot-sale',
        moduleName: '热卖商品',
        moduleType: 'PRODUCT_LIST',
        title: '门店热卖',
        displayOrder: 20,
        limitSize: 12,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        sortPolicyCode: 'SORT_RECOMMEND_WEIGHT',
        audiencePolicyCode: 'DEFAULT_AUDIENCE_ALL',
        cardTemplateCode: 'PRODUCT_CARD',
        uiConfig: { layout: 'grid-2' },
      },
      {
        moduleSlot: 'personal-recommend',
        moduleName: '个性推荐',
        moduleType: 'PRODUCT_LIST',
        title: '猜你喜欢',
        displayOrder: 30,
        limitSize: 20,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        sortPolicyCode: 'SORT_RECOMMEND_WEIGHT',
        audiencePolicyCode: 'DEFAULT_AUDIENCE_ALL',
        cardTemplateCode: 'PRODUCT_CARD',
        uiConfig: { layout: 'feed' },
      },
    ],
  },
  {
    templateCode: 'NEW_CUSTOMER_ZONE',
    templateName: '新人专享专区',
    sceneType: 'NEWCOMER',
    channelScope: ['miniapp', 'h5'],
    pageRoute: '/pages/marketing/detail?id=NEW_CUSTOMER_ZONE',
    defaultCardTemplateCode: 'COUPON_PACK_CARD',
    defaultResolverPolicyCode: 'DEFAULT_RESOLVER',
    placementConfig: {
      activityTypeFilter: 'NEWCOMER_EXCLUSIVE',
      storeMatchMode: 'CURRENT_STORE',
      sortMode: 'RECOMMEND_WEIGHT',
    },
    description: '新人礼包、券包与新人价商品组合。',
    modules: [
      {
        moduleSlot: 'newcomer-welcome',
        moduleName: '新人欢迎横幅',
        moduleType: 'BANNER',
        title: '新人见面礼',
        displayOrder: 10,
        limitSize: 1,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        audiencePolicyCode: 'NEWCOMER_AUDIENCE',
        cardTemplateCode: 'BANNER_CARD',
        uiConfig: { layout: 'hero' },
      },
      {
        moduleSlot: 'newcomer-coupon-pack',
        moduleName: '新人券包',
        moduleType: 'COUPON_PACK',
        title: '新人专属券包',
        displayOrder: 20,
        limitSize: 6,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        audiencePolicyCode: 'NEWCOMER_AUDIENCE',
        cardTemplateCode: 'COUPON_PACK_CARD',
        uiConfig: { layout: 'coupon-strip' },
      },
      {
        moduleSlot: 'newcomer-flash',
        moduleName: '新人限时价',
        moduleType: 'PRODUCT_LIST',
        title: '新人限时特惠',
        displayOrder: 30,
        limitSize: 10,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        sortPolicyCode: 'SORT_RECOMMEND_WEIGHT',
        audiencePolicyCode: 'NEWCOMER_AUDIENCE',
        cardTemplateCode: 'FLASH_SALE_CARD',
        uiConfig: { layout: 'timebox' },
      },
    ],
  },
  {
    templateCode: 'MEMBER_DAY_BANNER',
    templateName: '会员日 Banner',
    sceneType: 'MEMBER_DAY',
    channelScope: ['miniapp', 'h5'],
    pageRoute: '/pages/marketing/detail?id=MEMBER_DAY_BANNER',
    defaultCardTemplateCode: 'BANNER_CARD',
    defaultResolverPolicyCode: 'DEFAULT_RESOLVER',
    placementConfig: { activityTypeFilter: 'MEMBER_UPGRADE', storeMatchMode: 'CURRENT_STORE', sortMode: 'UPDATE_TIME' },
    description: '会员日主视觉、会员券和会员商品。',
    modules: [
      {
        moduleSlot: 'member-day-hero',
        moduleName: '会员日主视觉',
        moduleType: 'BANNER',
        title: '会员日',
        displayOrder: 10,
        limitSize: 1,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        audiencePolicyCode: 'MEMBER_AUDIENCE',
        cardTemplateCode: 'BANNER_CARD',
        uiConfig: { layout: 'hero' },
      },
      {
        moduleSlot: 'member-exclusive-coupons',
        moduleName: '会员专属券',
        moduleType: 'COUPON_PACK',
        title: '会员专享',
        displayOrder: 20,
        limitSize: 6,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        audiencePolicyCode: 'MEMBER_AUDIENCE',
        cardTemplateCode: 'COUPON_PACK_CARD',
        uiConfig: { layout: 'coupon-grid' },
      },
      {
        moduleSlot: 'member-products',
        moduleName: '会员商品',
        moduleType: 'PRODUCT_LIST',
        title: '会员价精选',
        displayOrder: 30,
        limitSize: 12,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        sortPolicyCode: 'SORT_RECOMMEND_WEIGHT',
        audiencePolicyCode: 'MEMBER_AUDIENCE',
        cardTemplateCode: 'PRODUCT_CARD',
        uiConfig: { layout: 'grid-2' },
      },
    ],
  },
  {
    templateCode: 'FLASH_SALE_TIMEBOX',
    templateName: '限时秒杀 Timebox',
    sceneType: 'FLASH_SALE',
    channelScope: ['miniapp', 'h5'],
    pageRoute: '/pages/marketing/detail?id=FLASH_SALE_TIMEBOX',
    defaultCardTemplateCode: 'FLASH_SALE_CARD',
    defaultResolverPolicyCode: 'DEFAULT_RESOLVER',
    placementConfig: { activityTypeFilter: 'FLASH_SALE', storeMatchMode: 'CURRENT_STORE', sortMode: 'UPDATE_TIME' },
    description: '当前场、预告场和预热位的秒杀组合。',
    modules: [
      {
        moduleSlot: 'flash-current',
        moduleName: '当前秒杀',
        moduleType: 'ACTIVITY_LIST',
        title: '正在秒杀',
        displayOrder: 10,
        limitSize: 8,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        sortPolicyCode: 'SORT_TIME_ASC',
        audiencePolicyCode: 'DEFAULT_AUDIENCE_ALL',
        cardTemplateCode: 'FLASH_SALE_CARD',
        uiConfig: { layout: 'countdown-grid' },
      },
      {
        moduleSlot: 'flash-upcoming',
        moduleName: '即将开始',
        moduleType: 'ACTIVITY_LIST',
        title: '即将开始',
        displayOrder: 20,
        limitSize: 8,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        sortPolicyCode: 'SORT_TIME_ASC',
        audiencePolicyCode: 'DEFAULT_AUDIENCE_ALL',
        cardTemplateCode: 'FLASH_SALE_CARD',
        uiConfig: { layout: 'timeline' },
      },
      {
        moduleSlot: 'flash-warmup',
        moduleName: '预热推荐',
        moduleType: 'PRODUCT_LIST',
        title: '提前加购',
        displayOrder: 30,
        limitSize: 10,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        sortPolicyCode: 'SORT_RECOMMEND_WEIGHT',
        audiencePolicyCode: 'DEFAULT_AUDIENCE_ALL',
        cardTemplateCode: 'PRODUCT_CARD',
        uiConfig: { layout: 'feed' },
      },
    ],
  },
  {
    templateCode: 'DISTRIBUTION_LANDING',
    templateName: '分销落地页',
    sceneType: 'DISTRIBUTION',
    channelScope: ['miniapp', 'h5'],
    pageRoute: '/pages/distribution/index',
    defaultCardTemplateCode: 'DISTRIBUTION_CARD',
    defaultResolverPolicyCode: 'DEFAULT_RESOLVER',
    placementConfig: {
      activityTypeFilter: 'DISTRIBUTION_GROWTH',
      storeMatchMode: 'CURRENT_STORE',
      sortMode: 'RECOMMEND_WEIGHT',
    },
    description: '分销活动落地页，含 Banner、可推广商品和推荐人卡片。',
    modules: [
      {
        moduleSlot: 'landing-banner',
        moduleName: '分销 Banner',
        moduleType: 'BANNER',
        title: '邀好友赚奖励',
        displayOrder: 10,
        limitSize: 1,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        audiencePolicyCode: 'DISTRIBUTION_AUDIENCE',
        cardTemplateCode: 'BANNER_CARD',
        uiConfig: { layout: 'hero' },
      },
      {
        moduleSlot: 'distribution-products',
        moduleName: '推广商品',
        moduleType: 'PRODUCT_LIST',
        title: '高佣推荐',
        displayOrder: 20,
        limitSize: 12,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        sortPolicyCode: 'SORT_RECOMMEND_WEIGHT',
        audiencePolicyCode: 'DISTRIBUTION_AUDIENCE',
        cardTemplateCode: 'DISTRIBUTION_CARD',
        uiConfig: { layout: 'commission-grid' },
      },
      {
        moduleSlot: 'referrer-card',
        moduleName: '推荐人卡片',
        moduleType: 'REFERRER_CARD',
        title: '我的推荐关系',
        displayOrder: 30,
        limitSize: 1,
        sourcePolicyCode: 'DEFAULT_SOURCE',
        resolverPolicyCode: 'DEFAULT_RESOLVER',
        audiencePolicyCode: 'DISTRIBUTION_AUDIENCE',
        cardTemplateCode: 'DISTRIBUTION_CARD',
        uiConfig: { layout: 'profile-card' },
      },
    ],
  },
];

export async function seedSceneTemplates(prisma: PrismaClient) {
  for (const template of TEMPLATES) {
    await prisma.mktSceneTemplate.upsert({
      where: { templateCode: template.templateCode },
      update: {
        templateName: template.templateName,
        sceneType: template.sceneType,
        channelScope: template.channelScope,
        pageRoute: template.pageRoute,
        defaultCardTemplateCode: template.defaultCardTemplateCode,
        defaultResolverPolicyCode: template.defaultResolverPolicyCode,
        placementConfig: template.placementConfig,
        description: template.description,
        isActive: true,
      },
      create: {
        templateCode: template.templateCode,
        templateName: template.templateName,
        sceneType: template.sceneType,
        channelScope: template.channelScope,
        pageRoute: template.pageRoute,
        defaultCardTemplateCode: template.defaultCardTemplateCode,
        defaultResolverPolicyCode: template.defaultResolverPolicyCode,
        placementConfig: template.placementConfig,
        description: template.description,
        isActive: true,
      },
    });

    await prisma.mktSceneTemplateModule.deleteMany({
      where: {
        templateCode: template.templateCode,
        moduleSlot: { notIn: template.modules.map((module) => module.moduleSlot) },
      },
    });

    for (const module of template.modules) {
      await prisma.mktSceneTemplateModule.upsert({
        where: {
          templateCode_moduleSlot: {
            templateCode: template.templateCode,
            moduleSlot: module.moduleSlot,
          },
        },
        update: {
          moduleName: module.moduleName,
          moduleType: module.moduleType,
          title: module.title,
          subTitle: module.subTitle ?? null,
          displayOrder: module.displayOrder,
          limitSize: module.limitSize,
          sourcePolicyCode: module.sourcePolicyCode,
          resolverPolicyCode: module.resolverPolicyCode,
          sortPolicyCode: module.sortPolicyCode ?? null,
          audiencePolicyCode: module.audiencePolicyCode ?? null,
          cardTemplateCode: module.cardTemplateCode,
          attributionPolicyCode: module.attributionPolicyCode ?? null,
          uiConfig: module.uiConfig ?? null,
        },
        create: {
          templateCode: template.templateCode,
          moduleSlot: module.moduleSlot,
          moduleName: module.moduleName,
          moduleType: module.moduleType,
          title: module.title,
          subTitle: module.subTitle ?? null,
          displayOrder: module.displayOrder,
          limitSize: module.limitSize,
          sourcePolicyCode: module.sourcePolicyCode,
          resolverPolicyCode: module.resolverPolicyCode,
          sortPolicyCode: module.sortPolicyCode ?? null,
          audiencePolicyCode: module.audiencePolicyCode ?? null,
          cardTemplateCode: module.cardTemplateCode,
          attributionPolicyCode: module.attributionPolicyCode ?? null,
          uiConfig: module.uiConfig ?? null,
        },
      });
    }
  }

  console.log('  ✓ 5 个营销场景模板已创建');
}
