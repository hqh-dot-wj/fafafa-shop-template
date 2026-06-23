import {
  CouponType,
  CouponValidityType,
  DelFlag,
  MarketingStockMode,
  Prisma,
  PrismaClient,
  ProductType,
  PublishStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_MARKETING_BLUEPRINT } from '../hunan-full/catalog-marketing';
import { assertHunanFullSeedScope, hunanFullAt, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

function toMarketingStockMode(mode: string): MarketingStockMode {
  if (mode === 'STRONG_LOCK') return MarketingStockMode.STRONG_LOCK;
  if (mode === 'LAZY_CHECK') return MarketingStockMode.LAZY_CHECK;
  return MarketingStockMode.LAZY_CHECK;
}

type CouponTemplateSeedData = {
  tenantId: string;
  name: string;
  description: string;
  type: CouponType;
  discountAmount: Decimal | null;
  discountPercent: number | null;
  maxDiscountAmount: Decimal | null;
  minOrderAmount: Decimal;
  minActualPayAmount: Decimal | null;
  applicableProducts: string[];
  applicableCategories: number[];
  memberLevels: number[];
  exchangeProductId: string | null;
  exchangeSkuId: string | null;
  validityType: CouponValidityType;
  startTime: Date | null;
  endTime: Date | null;
  validDays: number | null;
  totalStock: number;
  remainingStock: number;
  limitPerUser: number;
  status: 'ACTIVE';
};

export async function seedHunanMarketing(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanMarketing');
  console.log('[04-Selection] 湖南完整演示营销配置...');

  await prisma.mktPointsRule.upsert({
    where: { tenantId: HUNAN_FULL_TENANT_ID },
    update: {
      ...HUNAN_FULL_MARKETING_BLUEPRINT.pointsRule,
      orderPointsRatio: new Decimal(HUNAN_FULL_MARKETING_BLUEPRINT.pointsRule.orderPointsRatio),
      orderPointsBase: new Decimal(HUNAN_FULL_MARKETING_BLUEPRINT.pointsRule.orderPointsBase),
      pointsRedemptionRatio: new Decimal(HUNAN_FULL_MARKETING_BLUEPRINT.pointsRule.pointsRedemptionRatio),
      pointsRedemptionBase: new Decimal(HUNAN_FULL_MARKETING_BLUEPRINT.pointsRule.pointsRedemptionBase),
      updateBy: 'seed',
    },
    create: {
      tenantId: HUNAN_FULL_TENANT_ID,
      ...HUNAN_FULL_MARKETING_BLUEPRINT.pointsRule,
      orderPointsRatio: new Decimal(HUNAN_FULL_MARKETING_BLUEPRINT.pointsRule.orderPointsRatio),
      orderPointsBase: new Decimal(HUNAN_FULL_MARKETING_BLUEPRINT.pointsRule.orderPointsBase),
      pointsRedemptionRatio: new Decimal(HUNAN_FULL_MARKETING_BLUEPRINT.pointsRule.pointsRedemptionRatio),
      pointsRedemptionBase: new Decimal(HUNAN_FULL_MARKETING_BLUEPRINT.pointsRule.pointsRedemptionBase),
      createBy: 'seed',
      updateBy: null,
    },
  });

  for (const template of HUNAN_FULL_MARKETING_BLUEPRINT.couponTemplates) {
    const templateData: CouponTemplateSeedData = {
      tenantId: HUNAN_FULL_TENANT_ID,
      name: template.name,
      description: `${template.description} [${template.code}]`,
      type:
        template.type === 'DISCOUNT'
          ? CouponType.DISCOUNT
          : template.type === 'PERCENTAGE'
            ? CouponType.PERCENTAGE
            : CouponType.EXCHANGE,
      discountAmount: template.discountAmount == null ? null : new Decimal(template.discountAmount),
      discountPercent: template.discountPercent ?? null,
      maxDiscountAmount: template.maxDiscountAmount == null ? null : new Decimal(template.maxDiscountAmount),
      minOrderAmount: new Decimal(template.minOrderAmount),
      minActualPayAmount: null,
      applicableProducts: template.applicableProducts,
      applicableCategories: template.applicableCategories,
      memberLevels: template.memberLevels,
      exchangeProductId: template.exchangeProductId ?? null,
      exchangeSkuId: template.exchangeSkuId ?? null,
      validityType:
        template.validityType === 'FIXED' ? CouponValidityType.FIXED : CouponValidityType.RELATIVE,
      startTime: template.validityType === 'FIXED' ? hunanFullAt(-15) : null,
      endTime: template.validityType === 'FIXED' ? hunanFullAt(90) : null,
      validDays: template.validityType === 'RELATIVE' ? template.validDays ?? 15 : null,
      totalStock: template.totalStock,
      remainingStock: template.totalStock,
      limitPerUser: template.limitPerUser,
      status: 'ACTIVE' as const,
    };

    const existingTemplate = await prisma.mktCouponTemplate.findFirst({
      where: {
        tenantId: HUNAN_FULL_TENANT_ID,
        name: template.name,
      },
      orderBy: { createTime: 'asc' },
    });

    if (existingTemplate) {
      await prisma.mktCouponTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          ...templateData,
          createBy: existingTemplate.createBy,
          updateBy: 'seed',
        },
      });
      continue;
    }

    await prisma.mktCouponTemplate.create({
      data: {
        ...templateData,
        createBy: 'seed',
        updateBy: null,
      },
    });
  }

  for (const config of HUNAN_FULL_MARKETING_BLUEPRINT.storePlayConfigs) {
    await prisma.storePlayConfig.upsert({
      where: { id: config.configId },
      update: {
        tenantId: HUNAN_FULL_TENANT_ID,
        serviceId: config.serviceId,
        serviceType: config.serviceType === 'REAL' ? ProductType.REAL : ProductType.SERVICE,
        templateCode: config.templateCode,
        rules: config.rules as unknown as Prisma.InputJsonValue,
        rulesHistory: [],
        stockMode: toMarketingStockMode(config.stockMode),
        scopeType: config.scopeType,
        aggregateEnabled: config.aggregateEnabled,
        zoneEnabled: config.zoneEnabled,
        displayPriority: config.displayPriority,
        commissionMode: config.commissionMode,
        commissionRate: config.commissionRate == null ? null : new Decimal(config.commissionRate),
        status: config.status === 'ON_SHELF' ? PublishStatus.ON_SHELF : PublishStatus.OFF_SHELF,
        delFlag: DelFlag.NORMAL,
      },
      create: {
        id: config.configId,
        tenantId: HUNAN_FULL_TENANT_ID,
        serviceId: config.serviceId,
        serviceType: config.serviceType === 'REAL' ? ProductType.REAL : ProductType.SERVICE,
        templateCode: config.templateCode,
        rules: config.rules as unknown as Prisma.InputJsonValue,
        rulesHistory: [],
        stockMode: toMarketingStockMode(config.stockMode),
        scopeType: config.scopeType,
        aggregateEnabled: config.aggregateEnabled,
        zoneEnabled: config.zoneEnabled,
        displayPriority: config.displayPriority,
        commissionMode: config.commissionMode,
        commissionRate: config.commissionRate == null ? null : new Decimal(config.commissionRate),
        status: config.status === 'ON_SHELF' ? PublishStatus.ON_SHELF : PublishStatus.OFF_SHELF,
        delFlag: DelFlag.NORMAL,
      },
    });
  }

  console.log('  ✓ 积分规则、券模板、玩法配置');
}
