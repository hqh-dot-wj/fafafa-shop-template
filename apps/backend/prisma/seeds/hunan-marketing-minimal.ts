import {
  CouponType,
  CouponValidityType,
  DelFlag,
  MarketingStockMode,
  MemberStatus,
  PlayInstanceStatus,
  PrismaClient,
  ProductType,
  PublishStatus,
  Status,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  HUNAN_DEMO_PRODUCT_DRINK_ID,
  HUNAN_DEMO_PRODUCT_FRUIT_ID,
  seedHunanDemoProducts,
} from './hunan-demo-products';
import { seedH5DemoPasswordMember } from './h5-demo-password-member';

const HUNAN_TENANT_ID = '000000';
const HUNAN_COMPANY_NAME = '湖南科技有限公司';

const SOURCE_POLICY_CODE = 'NR_SOURCE_PRODUCTS';
const RESOLVER_POLICY_CODE = 'NR_RESOLVER_DEFAULT';
const SORT_POLICY_CODE = 'NR_SORT_PRICE_ASC';
const AUDIENCE_POLICY_CODE = 'NR_AUDIENCE_ALL';
const CARD_POLICY_CODE = 'NR_CARD_SIMPLE';

const SCENE_CODE = 'NR_HOME_RECOMMEND';
const MODULE_FRUIT_CODE = 'NR_HOME_FRUIT';
const MODULE_DRINK_CODE = 'NR_HOME_DRINK';
const MARKETING_ROOT_MENU_ID = 7;
const MARKETING_GROUP_ACTIVITY_CENTER_ID = 1221;
const MARKETING_GROUP_SCENE_PLACEMENT_ID = 1222;
const MARKETING_GROUP_COURSE_GROUP_ID = 274;
const MARKETING_GROUP_COMMON_MARKETING_ID = 1224;
const MARKETING_GROUP_ADVANCED_CONFIG_ID = 1223;
const MARKETING_COMMON_CHILD_MENU_IDS = [260, 261, 263, 269] as const;
// 不含 1220/1081/1082：裁决与规则及子项为兼容入口，已并入策略中心（平台种子默认隐藏），湖南种子勿改为可见
const MARKETING_ADVANCED_CHILD_MENU_IDS = [268, 1080, 1086, 1087, 1088, 1217, 1114, 1136] as const;

type CouponSeed = {
  name: string;
  type: CouponType;
  discountAmount?: number;
  discountPercent?: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
};

async function assertHunanTenantGuard(prisma: PrismaClient, phase: string): Promise<void> {
  const tenant = await prisma.sysTenant.findUnique({
    where: { tenantId: HUNAN_TENANT_ID },
    select: { tenantId: true, companyName: true, delFlag: true },
  });

  if (!tenant) {
    throw new Error(`[Hunan-Marketing] Guard failed at ${phase}: tenant ${HUNAN_TENANT_ID} not found.`);
  }
  if (tenant.companyName !== HUNAN_COMPANY_NAME) {
    throw new Error(
      `[Hunan-Marketing] Guard failed at ${phase}: tenant ${HUNAN_TENANT_ID} companyName mismatch (expected "${HUNAN_COMPANY_NAME}", actual "${tenant.companyName}").`,
    );
  }
  if (tenant.delFlag !== DelFlag.NORMAL) {
    throw new Error(
      `[Hunan-Marketing] Guard failed at ${phase}: tenant ${HUNAN_TENANT_ID} is deleted (delFlag=${tenant.delFlag}).`,
    );
  }
}

/**
 * 湖南总平台营销最小种子：
 * - demo 商品 2 个（仅租户 000000 的营销联调用商品）
 * - 积分规则 1 套（仅租户 000000）
 * - 优惠券模板 3 张（仅租户 000000）
 * - 营销玩法模板 3 个（全局模板表，按 code 收敛，不与历史模板混用）
 */
export async function seedHunanMarketingMinimal(prisma: PrismaClient): Promise<void> {
  await assertHunanTenantGuard(prisma, 'seedHunanMarketingMinimal:start');
  console.log('[Hunan-Marketing] 初始化营销最小集合...');

  await ensureMarketingPageMenus(prisma);
  await seedHunanDemoProducts(prisma);
  await seedHunanPointsRule(prisma);
  await seedHunanCoupons(prisma);
  await seedHunanPlayTemplatesSafe(prisma);
  await seedHunanFivePageLinkage(prisma);
  await seedH5DemoPasswordMember(prisma);

  console.log('[Hunan-Marketing] ✓ 商品 2 个、积分 1 套、优惠券 3 张、玩法模板 3 个、联调链路 1 套、H5 密码联调账号');
}

async function ensureMarketingPageMenus(prisma: PrismaClient): Promise<void> {
  await assertHunanTenantGuard(prisma, 'ensureMarketingPageMenus');
  const now = new Date();
  const topLevelGroups = [
    {
      menuId: MARKETING_GROUP_ACTIVITY_CENTER_ID,
      menuName: '活动中心',
      orderNum: 1,
      path: 'activity-center',
      icon: 'date',
    },
    {
      menuId: MARKETING_GROUP_SCENE_PLACEMENT_ID,
      menuName: '场景投放',
      orderNum: 2,
      path: 'scene-placement',
      icon: 'tree',
    },
    {
      menuId: MARKETING_GROUP_COURSE_GROUP_ID,
      menuName: '拼课专区',
      orderNum: 3,
      path: 'course-group',
      icon: 'education',
    },
    {
      menuId: MARKETING_GROUP_COMMON_MARKETING_ID,
      menuName: '通用营销',
      orderNum: 4,
      path: 'common-marketing',
      icon: 'shopping',
    },
    {
      menuId: MARKETING_GROUP_ADVANCED_CONFIG_ID,
      menuName: '高级配置',
      orderNum: 5,
      path: 'advanced-config',
      icon: 'setting',
    },
  ] as const;

  for (const group of topLevelGroups) {
    await prisma.sysMenu.updateMany({
      where: { tenantId: HUNAN_TENANT_ID, menuId: group.menuId },
      data: {
        parentId: MARKETING_ROOT_MENU_ID,
        menuName: group.menuName,
        orderNum: group.orderNum,
        path: group.path,
        component: null,
        menuType: 'M',
        status: Status.NORMAL,
        visible: '0',
        icon: group.icon,
        updateBy: 'seed',
        updateTime: now,
      },
    });
  }

  await prisma.sysMenu.updateMany({
    where: { tenantId: HUNAN_TENANT_ID, menuId: { in: [...MARKETING_COMMON_CHILD_MENU_IDS] } },
    data: {
      parentId: MARKETING_GROUP_COMMON_MARKETING_ID,
      status: Status.NORMAL,
      visible: '0',
      updateBy: 'seed',
      updateTime: now,
    },
  });

  await prisma.sysMenu.updateMany({
    where: { tenantId: HUNAN_TENANT_ID, menuId: { in: [...MARKETING_ADVANCED_CHILD_MENU_IDS] } },
    data: {
      parentId: MARKETING_GROUP_ADVANCED_CONFIG_ID,
      status: Status.NORMAL,
      visible: '0',
      updateBy: 'seed',
      updateTime: now,
    },
  });

  await prisma.sysMenu.updateMany({
    where: { tenantId: HUNAN_TENANT_ID, menuId: 1114 },
    data: {
      parentId: MARKETING_GROUP_ADVANCED_CONFIG_ID,
      menuType: 'C',
      path: 'config',
      component: 'marketing/config/index',
      status: Status.NORMAL,
      visible: '0',
      updateBy: 'seed',
      updateTime: now,
    },
  });

  await prisma.sysMenu.updateMany({
    where: { tenantId: HUNAN_TENANT_ID, menuId: 1136 },
    data: {
      parentId: MARKETING_GROUP_ADVANCED_CONFIG_ID,
      menuType: 'C',
      path: 'instance',
      component: 'marketing/instance/index',
      status: Status.NORMAL,
      visible: '0',
      updateBy: 'seed',
      updateTime: now,
    },
  });

}

async function seedHunanPointsRule(prisma: PrismaClient): Promise<void> {
  await assertHunanTenantGuard(prisma, 'seedHunanPointsRule');
  await prisma.mktPointsRule.upsert({
    where: { tenantId: HUNAN_TENANT_ID },
    update: {
      orderPointsEnabled: true,
      orderPointsRatio: new Decimal(1),
      orderPointsBase: new Decimal(1),
      signinPointsEnabled: true,
      signinPointsAmount: 10,
      pointsValidityEnabled: false,
      pointsValidityDays: null,
      pointsRedemptionEnabled: true,
      pointsRedemptionRatio: new Decimal(100),
      pointsRedemptionBase: new Decimal(1),
      maxPointsPerOrder: 5000,
      maxDiscountPercentOrder: 50,
      systemEnabled: true,
      updateBy: 'seed',
    },
    create: {
      tenantId: HUNAN_TENANT_ID,
      orderPointsEnabled: true,
      orderPointsRatio: new Decimal(1),
      orderPointsBase: new Decimal(1),
      signinPointsEnabled: true,
      signinPointsAmount: 10,
      pointsValidityEnabled: false,
      pointsValidityDays: null,
      pointsRedemptionEnabled: true,
      pointsRedemptionRatio: new Decimal(100),
      pointsRedemptionBase: new Decimal(1),
      maxPointsPerOrder: 5000,
      maxDiscountPercentOrder: 50,
      systemEnabled: true,
      createBy: 'seed',
      updateBy: null,
    },
  });
}

async function seedHunanCoupons(prisma: PrismaClient): Promise<void> {
  await assertHunanTenantGuard(prisma, 'seedHunanCoupons');
  const now = new Date();
  const startTime = new Date(now.getFullYear(), now.getMonth(), 1);
  const endTime = new Date(now.getFullYear(), now.getMonth() + 3, 0);

  const coupons: CouponSeed[] = [
    { name: '新人满100减20', type: CouponType.DISCOUNT, discountAmount: 20, minOrderAmount: 100 },
    { name: '满200减40', type: CouponType.DISCOUNT, discountAmount: 40, minOrderAmount: 200 },
    { name: '9折折扣券', type: CouponType.PERCENTAGE, discountPercent: 90, maxDiscountAmount: 50, minOrderAmount: 0 },
  ] as const;

  // 只保留湖南这 3 张，不与历史租户券混用
  await prisma.mktCouponTemplate.deleteMany({ where: { tenantId: HUNAN_TENANT_ID } });

  for (const c of coupons) {
    await prisma.mktCouponTemplate.create({
      data: {
        tenantId: HUNAN_TENANT_ID,
        name: c.name,
        description: c.name,
        type: c.type,
        discountAmount: c.discountAmount ? new Decimal(c.discountAmount) : null,
        discountPercent: c.discountPercent ?? null,
        maxDiscountAmount: c.maxDiscountAmount ? new Decimal(c.maxDiscountAmount) : null,
        minOrderAmount: new Decimal(c.minOrderAmount),
        minActualPayAmount: null,
        applicableProducts: [],
        applicableCategories: [],
        memberLevels: [],
        exchangeProductId: null,
        exchangeSkuId: null,
        validityType: CouponValidityType.FIXED,
        startTime,
        endTime,
        validDays: null,
        totalStock: 1000,
        remainingStock: 1000,
        limitPerUser: 1,
        status: 'ACTIVE',
        createBy: 'seed',
        updateBy: null,
      },
    });
  }
}

async function seedHunanPlayTemplatesSafe(prisma: PrismaClient): Promise<void> {
  await assertHunanTenantGuard(prisma, 'seedHunanPlayTemplatesSafe');
  // playTemplate 是全局表：湖南最小链路只做 upsert，不做 deleteMany 清理，
  // 避免误改非湖南租户或其他历史流程依赖模板。
  await prisma.playTemplate.upsert({
    where: { code: 'COURSE_GROUP_BUY' },
    update: {
      name: '拼班课程',
      unitName: '节',
      ruleSchema: {
        fields: [
          { key: 'price', label: '课程价格', type: 'number', required: true },
          { key: 'minCount', label: '最低开班人数', type: 'number', required: true },
          { key: 'maxCount', label: '最高招生人数', type: 'number', required: true },
          { key: 'joinDeadline', label: '报名截止时间', type: 'string', required: true },
          { key: 'classStartTime', label: '开课时间', type: 'string', required: true },
          { key: 'classAddress', label: '上课地址', type: 'string', required: true },
          { key: 'totalLessons', label: '总课时数', type: 'number', required: true },
          { key: 'dayLessons', label: '每日课时', type: 'number', required: true },
        ],
      },
      status: Status.NORMAL,
      delFlag: DelFlag.NORMAL,
    },
    create: {
      code: 'COURSE_GROUP_BUY',
      name: '拼班课程',
      unitName: '节',
      ruleSchema: {
        fields: [
          { key: 'price', label: '课程价格', type: 'number', required: true },
          { key: 'minCount', label: '最低开班人数', type: 'number', required: true },
          { key: 'maxCount', label: '最高招生人数', type: 'number', required: true },
          { key: 'joinDeadline', label: '报名截止时间', type: 'string', required: true },
          { key: 'classStartTime', label: '开课时间', type: 'string', required: true },
          { key: 'classAddress', label: '上课地址', type: 'string', required: true },
          { key: 'totalLessons', label: '总课时数', type: 'number', required: true },
          { key: 'dayLessons', label: '每日课时', type: 'number', required: true },
        ],
      },
      uiComponentId: null,
      productId: null,
      skuId: null,
      productName: null,
      status: Status.NORMAL,
      delFlag: DelFlag.NORMAL,
    },
  });

  await prisma.playTemplate.upsert({
    where: { code: 'FLASH_SALE' },
    update: {
      name: '限时秒杀',
      unitName: '件',
      ruleSchema: {
        fields: [
          { key: 'flashPrice', label: '秒杀价格', type: 'number', required: true },
          { key: 'totalStock', label: '总库存数量', type: 'number', required: true },
          { key: 'limitPerUser', label: '每人限购数量', type: 'number', required: false },
          { key: 'startTime', label: '秒杀开始时间', type: 'string', required: true },
          { key: 'endTime', label: '秒杀结束时间', type: 'string', required: true },
        ],
      },
      status: Status.NORMAL,
      delFlag: DelFlag.NORMAL,
    },
    create: {
      code: 'FLASH_SALE',
      name: '限时秒杀',
      unitName: '件',
      ruleSchema: {
        fields: [
          { key: 'flashPrice', label: '秒杀价格', type: 'number', required: true },
          { key: 'totalStock', label: '总库存数量', type: 'number', required: true },
          { key: 'limitPerUser', label: '每人限购数量', type: 'number', required: false },
          { key: 'startTime', label: '秒杀开始时间', type: 'string', required: true },
          { key: 'endTime', label: '秒杀结束时间', type: 'string', required: true },
        ],
      },
      uiComponentId: null,
      productId: null,
      skuId: null,
      productName: null,
      status: Status.NORMAL,
      delFlag: DelFlag.NORMAL,
    },
  });

  await prisma.playTemplate.upsert({
    where: { code: 'MEMBER_UPGRADE' },
    update: {
      name: '会员升级',
      unitName: '次',
      ruleSchema: {
        fields: [
          { key: 'targetLevel', label: '目标等级', type: 'number', required: true },
          { key: 'price', label: '升级价格', type: 'number', required: true },
          { key: 'autoApprove', label: '自动审批', type: 'boolean', required: false },
        ],
      },
      status: Status.NORMAL,
      delFlag: DelFlag.NORMAL,
    },
    create: {
      code: 'MEMBER_UPGRADE',
      name: '会员升级',
      unitName: '次',
      ruleSchema: {
        fields: [
          { key: 'targetLevel', label: '目标等级', type: 'number', required: true },
          { key: 'price', label: '升级价格', type: 'number', required: true },
          { key: 'autoApprove', label: '自动审批', type: 'boolean', required: false },
        ],
      },
      uiComponentId: null,
      productId: null,
      skuId: null,
      productName: null,
      status: Status.NORMAL,
      delFlag: DelFlag.NORMAL,
    },
  });
}

async function _seedHunanPlayTemplates(prisma: PrismaClient): Promise<void> {
  if (process.env.ALLOW_DANGEROUS_HUNAN_PLAY_TEMPLATE_CLEANUP !== 'true') {
    throw new Error(
      '[Hunan-Marketing] seedHunanPlayTemplates is disabled by default to prevent global playTemplate cleanup. Use seedHunanPlayTemplatesSafe instead.',
    );
  }

  const templates = [
    {
      code: 'COURSE_GROUP_BUY',
      name: '拼班课程',
      unitName: '节',
      ruleSchema: {
        fields: [
          { key: 'price', label: '课程价格', type: 'number', required: true },
          { key: 'minCount', label: '最低开班人数', type: 'number', required: true },
          { key: 'maxCount', label: '最高招生人数', type: 'number', required: true },
          { key: 'joinDeadline', label: '报名截止时间', type: 'string', required: true },
          { key: 'classStartTime', label: '开课时间', type: 'string', required: true },
          { key: 'classAddress', label: '上课地址', type: 'string', required: true },
          { key: 'totalLessons', label: '总课时数', type: 'number', required: true },
          { key: 'dayLessons', label: '每日课时', type: 'number', required: true },
        ],
      },
    },
    {
      code: 'FLASH_SALE',
      name: '限时秒杀',
      unitName: '件',
      ruleSchema: {
        fields: [
          { key: 'flashPrice', label: '秒杀价格', type: 'number', required: true },
          { key: 'totalStock', label: '总库存数量', type: 'number', required: true },
          { key: 'limitPerUser', label: '每人限购数量', type: 'number', required: false },
          { key: 'startTime', label: '秒杀开始时间', type: 'string', required: true },
          { key: 'endTime', label: '秒杀结束时间', type: 'string', required: true },
        ],
      },
    },
    {
      code: 'MEMBER_UPGRADE',
      name: '会员升级',
      unitName: '次',
      ruleSchema: {
        fields: [
          { key: 'targetLevel', label: '目标等级', type: 'number', required: true },
          { key: 'price', label: '升级价格', type: 'number', required: true },
          { key: 'autoApprove', label: '自动审批', type: 'boolean', required: false },
        ],
      },
    },
  ] as const;

  const allowedCodes = templates.map((t) => t.code);
  // 模板是全局表：湖南初始化时收敛为这 3 个，避免与历史模板混在一起
  await prisma.playTemplate.deleteMany({ where: { code: { notIn: allowedCodes as string[] } } });

  for (const t of templates) {
    await prisma.playTemplate.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        unitName: t.unitName,
        ruleSchema: t.ruleSchema,
        status: Status.NORMAL,
        delFlag: DelFlag.NORMAL,
      },
      create: {
        code: t.code,
        name: t.name,
        unitName: t.unitName,
        ruleSchema: t.ruleSchema,
        uiComponentId: null,
        productId: null,
        skuId: null,
        productName: null,
        status: Status.NORMAL,
        delFlag: DelFlag.NORMAL,
      },
    });
  }
}

async function seedHunanFivePageLinkage(prisma: PrismaClient): Promise<void> {
  await assertHunanTenantGuard(prisma, 'seedHunanFivePageLinkage');
  console.log('[Hunan-Marketing] 初始化五页联调链路数据...');

  await seedPolicies(prisma);
  await seedSceneAndModules(prisma);
  const configIds = await seedStoreConfigs(prisma);
  await seedDemoMarketingMembers(prisma);
  await seedPlayInstances(prisma, configIds);

  console.log('[Hunan-Marketing] ✓ 五页联调链路数据已就绪');
}

async function seedPolicies(prisma: PrismaClient): Promise<void> {
  await assertHunanTenantGuard(prisma, 'seedPolicies');
  await prisma.mktPolicy.deleteMany({
    where: {
      tenantId: HUNAN_TENANT_ID,
      policyCode: {
        in: [SOURCE_POLICY_CODE, RESOLVER_POLICY_CODE, SORT_POLICY_CODE, AUDIENCE_POLICY_CODE, CARD_POLICY_CODE],
      },
    },
  });

  await prisma.mktPolicy.createMany({
    data: [
      {
        tenantId: HUNAN_TENANT_ID,
        policyCode: SOURCE_POLICY_CODE,
        policyName: '新零售商品池（水果+饮品）',
        policyType: 'SOURCE',
        config: {
          clauses: [
            {
              field: 'productId',
              operator: 'IN',
              value: [HUNAN_DEMO_PRODUCT_FRUIT_ID, HUNAN_DEMO_PRODUCT_DRINK_ID],
            },
            { field: 'publishStatus', operator: 'EQ', value: 'ON_SHELF' },
          ],
        },
        status: 'ACTIVE',
      },
      {
        tenantId: HUNAN_TENANT_ID,
        policyCode: RESOLVER_POLICY_CODE,
        policyName: '默认裁决策略',
        policyType: 'RESOLVER',
        config: {
          primaryOfferTypes: ['FLASH_SALE', 'COURSE_GROUP_BUY', 'MEMBER_UPGRADE'],
          conflictMatrix: {
            FLASH_SALE: ['COURSE_GROUP_BUY', 'MEMBER_UPGRADE'],
            COURSE_GROUP_BUY: ['FLASH_SALE'],
            MEMBER_UPGRADE: [],
          },
        },
        status: 'ACTIVE',
      },
      {
        tenantId: HUNAN_TENANT_ID,
        policyCode: SORT_POLICY_CODE,
        policyName: '按价格升序',
        policyType: 'SORT',
        config: {
          sortRules: [{ field: 'price', order: 'asc', nulls: 'last' }],
        },
        status: 'ACTIVE',
      },
      {
        tenantId: HUNAN_TENANT_ID,
        policyCode: AUDIENCE_POLICY_CODE,
        policyName: '全量用户',
        policyType: 'AUDIENCE',
        config: {
          rules: { mode: 'ALL' },
        },
        status: 'ACTIVE',
      },
      {
        tenantId: HUNAN_TENANT_ID,
        policyCode: CARD_POLICY_CODE,
        policyName: '简版卡片模板',
        policyType: 'CARD_TEMPLATE',
        config: {
          templateConfig: {
            cardStyle: 'simple',
            showTags: true,
            showPrice: true,
          },
        },
        status: 'ACTIVE',
      },
    ],
  });
}

async function seedSceneAndModules(prisma: PrismaClient): Promise<void> {
  await assertHunanTenantGuard(prisma, 'seedSceneAndModules');
  await prisma.mktSceneRelease.deleteMany({
    where: {
      tenantId: HUNAN_TENANT_ID,
      sceneCode: SCENE_CODE,
    },
  });

  await prisma.mktSceneModule.deleteMany({
    where: {
      tenantId: HUNAN_TENANT_ID,
      moduleCode: { in: [MODULE_FRUIT_CODE, MODULE_DRINK_CODE] },
    },
  });

  await prisma.mktScene.upsert({
    where: {
      tenantId_sceneCode: {
        tenantId: HUNAN_TENANT_ID,
        sceneCode: SCENE_CODE,
      },
    },
    update: {
      sceneName: '首页推荐场景',
      sceneType: 'HOMEPAGE',
      channelScope: ['miniapp'],
      pageRoute: '/pages/index/index',
      defaultCardTemplateCode: CARD_POLICY_CODE,
      defaultResolverPolicyCode: RESOLVER_POLICY_CODE,
      placementConfig: {
        activityTypeFilter: 'FLASH_SALE',
        storeMatchMode: 'CURRENT_STORE',
        sortMode: 'RECOMMEND_WEIGHT',
      },
      status: 'ACTIVE',
    },
    create: {
      tenantId: HUNAN_TENANT_ID,
      sceneCode: SCENE_CODE,
      sceneName: '首页推荐场景',
      sceneType: 'HOMEPAGE',
      channelScope: ['miniapp'],
      pageRoute: '/pages/index/index',
      defaultCardTemplateCode: CARD_POLICY_CODE,
      defaultResolverPolicyCode: RESOLVER_POLICY_CODE,
      placementConfig: {
        activityTypeFilter: 'FLASH_SALE',
        storeMatchMode: 'CURRENT_STORE',
        sortMode: 'RECOMMEND_WEIGHT',
      },
      status: 'ACTIVE',
    },
  });

  await prisma.mktSceneModule.createMany({
    data: [
      {
        tenantId: HUNAN_TENANT_ID,
        sceneCode: SCENE_CODE,
        moduleCode: MODULE_FRUIT_CODE,
        moduleName: '应季鲜果推荐',
        moduleType: 'PRODUCT_LIST',
        title: '应季鲜果',
        subTitle: '当天到店优选',
        displayOrder: 10,
        limitSize: 20,
        sourcePolicyCode: SOURCE_POLICY_CODE,
        resolverPolicyCode: RESOLVER_POLICY_CODE,
        sortPolicyCode: SORT_POLICY_CODE,
        audiencePolicyCode: AUDIENCE_POLICY_CODE,
        cardTemplateCode: CARD_POLICY_CODE,
        attributionPolicyCode: null,
        uiConfig: { layout: 'grid-2' },
        status: 'ACTIVE',
      },
      {
        tenantId: HUNAN_TENANT_ID,
        sceneCode: SCENE_CODE,
        moduleCode: MODULE_DRINK_CODE,
        moduleName: '饮品爆款推荐',
        moduleType: 'PRODUCT_LIST',
        title: '热销饮品',
        subTitle: '销量优先展示',
        displayOrder: 20,
        limitSize: 20,
        sourcePolicyCode: SOURCE_POLICY_CODE,
        resolverPolicyCode: RESOLVER_POLICY_CODE,
        sortPolicyCode: SORT_POLICY_CODE,
        audiencePolicyCode: AUDIENCE_POLICY_CODE,
        cardTemplateCode: CARD_POLICY_CODE,
        attributionPolicyCode: null,
        uiConfig: { layout: 'list' },
        status: 'ACTIVE',
      },
    ],
  });

  await prisma.mktSceneRelease.create({
    data: {
      tenantId: HUNAN_TENANT_ID,
      sceneCode: SCENE_CODE,
      releaseNo: 1,
      releaseStatus: 'PUBLISHED',
      releaseSnapshot: {
        sceneCode: SCENE_CODE,
        modules: [MODULE_FRUIT_CODE, MODULE_DRINK_CODE],
      },
      publishedBy: 'seed',
      publishedAt: new Date(),
    },
  });
}

type DemoConfigIds = {
  fruitConfigId: string;
  drinkConfigId: string;
};

const DEMO_PLAY_MEMBER_PASSWORD =
  '$2b$10$UrJrjy0kxyrTO1UvhRVsvex35mB1s1jzAraIA9xtzPmlLmRtZXEXS';

/** 为营销实例演示数据补齐 C 端会员，便于后台列表展示昵称/手机号 */
async function seedDemoMarketingMembers(prisma: PrismaClient): Promise<void> {
  await assertHunanTenantGuard(prisma, 'seedDemoMarketingMembers');
  const seeds = [
    { memberId: 'demo-member-001', nickname: '演示会员·张三' },
    { memberId: 'demo-member-002', nickname: '演示会员·李四' },
    { memberId: 'demo-member-003', nickname: '演示会员·王五' },
  ] as const;
  for (const m of seeds) {
    await prisma.umsMember.upsert({
      where: { memberId: m.memberId },
      create: {
        memberId: m.memberId,
        tenantId: HUNAN_TENANT_ID,
        nickname: m.nickname,
        mobile: null,
        password: DEMO_PLAY_MEMBER_PASSWORD,
        status: MemberStatus.NORMAL,
        levelId: 0,
        balance: new Decimal(0),
        frozenBalance: new Decimal(0),
        points: 0,
      },
      update: {
        nickname: m.nickname,
        tenantId: HUNAN_TENANT_ID,
      },
    });
  }
}

async function seedStoreConfigs(prisma: PrismaClient): Promise<DemoConfigIds> {
  await assertHunanTenantGuard(prisma, 'seedStoreConfigs');
  const existingConfigs = await prisma.storePlayConfig.findMany({
    where: {
      tenantId: HUNAN_TENANT_ID,
      serviceId: { in: [HUNAN_DEMO_PRODUCT_FRUIT_ID, HUNAN_DEMO_PRODUCT_DRINK_ID] },
    },
    select: { id: true },
  });
  const existingConfigIds = existingConfigs.map(item => item.id);
  if (existingConfigIds.length > 0) {
    await prisma.playInstance.deleteMany({
      where: {
        tenantId: HUNAN_TENANT_ID,
        configId: { in: existingConfigIds },
      },
    });
  }

  await prisma.storePlayConfig.deleteMany({
    where: {
      tenantId: HUNAN_TENANT_ID,
      serviceId: { in: [HUNAN_DEMO_PRODUCT_FRUIT_ID, HUNAN_DEMO_PRODUCT_DRINK_ID] },
    },
  });

  const fruitConfig = await prisma.storePlayConfig.create({
    data: {
      tenantId: HUNAN_TENANT_ID,
      serviceId: HUNAN_DEMO_PRODUCT_FRUIT_ID,
      serviceType: ProductType.REAL,
      templateCode: 'COURSE_GROUP_BUY',
      rules: {
        name: '社区拼班体验课',
        price: 39.9,
        minCount: 2,
        maxCount: 12,
        totalLessons: 4,
        dayLessons: 1,
        joinDeadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        classStartTime: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
        classEndTime: new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString(),
        classAddress: '长沙市岳麓区社区教室',
        leaderMustBeDistributor: false,
      },
      stockMode: MarketingStockMode.LAZY_CHECK,
      status: PublishStatus.ON_SHELF,
      scopeType: 'PRODUCT',
      aggregateEnabled: true,
      zoneEnabled: true,
      displayPriority: 100,
      commissionMode: 'NONE',
      commissionRate: null,
    },
  });

  const drinkConfig = await prisma.storePlayConfig.create({
    data: {
      tenantId: HUNAN_TENANT_ID,
      serviceId: HUNAN_DEMO_PRODUCT_DRINK_ID,
      serviceType: ProductType.REAL,
      templateCode: 'FLASH_SALE',
      rules: {
        name: 'if椰子水限时秒杀',
        flashPrice: 9.9,
        totalStock: 200,
        limitPerUser: 2,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      },
      stockMode: MarketingStockMode.STRONG_LOCK,
      status: PublishStatus.ON_SHELF,
      scopeType: 'PRODUCT',
      aggregateEnabled: true,
      zoneEnabled: true,
      displayPriority: 90,
      commissionMode: 'NONE',
      commissionRate: null,
    },
  });

  return {
    fruitConfigId: fruitConfig.id,
    drinkConfigId: drinkConfig.id,
  };
}

async function seedPlayInstances(prisma: PrismaClient, configIds: DemoConfigIds): Promise<void> {
  await assertHunanTenantGuard(prisma, 'seedPlayInstances');
  await prisma.playInstance.deleteMany({
    where: {
      tenantId: HUNAN_TENANT_ID,
      memberId: {
        in: ['demo-member-001', 'demo-member-002', 'demo-member-003'],
      },
    },
  });

  await prisma.playInstance.createMany({
    data: [
      {
        tenantId: HUNAN_TENANT_ID,
        memberId: 'demo-member-001',
        configId: configIds.fruitConfigId,
        templateCode: 'COURSE_GROUP_BUY',
        instanceData: {
          quantity: 1,
          price: 39.9,
          orderSn: 'DEMO-ORDER-001',
          isLeader: true,
          currentCount: 1,
        },
        status: PlayInstanceStatus.PENDING_PAY,
      },
      {
        tenantId: HUNAN_TENANT_ID,
        memberId: 'demo-member-002',
        configId: configIds.drinkConfigId,
        templateCode: 'FLASH_SALE',
        instanceData: {
          quantity: 1,
          price: 9.9,
          orderSn: 'DEMO-ORDER-002',
          stockLocked: true,
          stockReleased: false,
        },
        status: PlayInstanceStatus.ACTIVE,
      },
      {
        tenantId: HUNAN_TENANT_ID,
        memberId: 'demo-member-003',
        configId: configIds.fruitConfigId,
        templateCode: 'COURSE_GROUP_BUY',
        instanceData: {
          quantity: 1,
          price: 39.9,
          orderSn: 'DEMO-ORDER-003',
          isLeader: true,
          currentCount: 2,
        },
        status: PlayInstanceStatus.SUCCESS,
      },
    ],
  });
}
