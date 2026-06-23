import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_MARKETING_BLUEPRINT } from '../hunan-full/catalog-marketing';
import { assertHunanFullSeedScope, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

export async function seedHunanDistributionGovernance(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanDistributionGovernance');
  console.log('[02-System] 湖南完整演示分销治理...');

  await prisma.sysDistConfig.upsert({
    where: { tenantId: HUNAN_FULL_TENANT_ID },
    update: {
      level1Rate: new Decimal(0.04),
      level2Rate: new Decimal(0.06),
      enableLV0: true,
      enableCrossTenant: false,
      crossTenantRate: new Decimal(1),
      crossMaxDaily: new Decimal(800),
      commissionBaseType: 'ORIGINAL_PRICE',
      maxCommissionRate: new Decimal(0.5),
      updateBy: 'seed',
    },
    create: {
      tenantId: HUNAN_FULL_TENANT_ID,
      level1Rate: new Decimal(0.04),
      level2Rate: new Decimal(0.06),
      enableLV0: true,
      enableCrossTenant: false,
      crossTenantRate: new Decimal(1),
      crossMaxDaily: new Decimal(800),
      commissionBaseType: 'ORIGINAL_PRICE',
      maxCommissionRate: new Decimal(0.5),
      createBy: 'seed',
      updateBy: 'seed',
    },
  });

  const levels = [
    {
      levelId: 0,
      levelName: '普通会员',
      level1Rate: 0,
      level2Rate: 0,
      benefits: '普通购物积分与新人券权益',
      sort: 0,
    },
    {
      levelId: 1,
      levelName: '一级分销员',
      level1Rate: 0.04,
      level2Rate: 0.06,
      benefits: '可获得一级与二级推荐佣金',
      sort: 1,
    },
    {
      levelId: 2,
      levelName: '二级合伙人',
      level1Rate: 0.05,
      level2Rate: 0.08,
      benefits: '高阶课程、高毛利商品更高分佣',
      sort: 2,
    },
  ] as const;

  for (const level of levels) {
    await prisma.sysDistLevel.upsert({
      where: {
        tenantId_levelId: {
          tenantId: HUNAN_FULL_TENANT_ID,
          levelId: level.levelId,
        },
      },
      update: {
        levelName: level.levelName,
        level1Rate: new Decimal(level.level1Rate),
        level2Rate: new Decimal(level.level2Rate),
        benefits: level.benefits,
        sort: level.sort,
        isActive: true,
        updateBy: 'seed',
      },
      create: {
        tenantId: HUNAN_FULL_TENANT_ID,
        levelId: level.levelId,
        levelName: level.levelName,
        level1Rate: new Decimal(level.level1Rate),
        level2Rate: new Decimal(level.level2Rate),
        upgradeCondition: { orderAmount: level.levelId === 2 ? 1999 : 299 },
        maintainCondition: { activeDays: 30 },
        benefits: level.benefits,
        sort: level.sort,
        isActive: true,
        createBy: 'seed',
        updateBy: 'seed',
      },
    });
  }

  await prisma.sysDistReviewConfig.upsert({
    where: { tenantId: HUNAN_FULL_TENANT_ID },
    update: {
      ...HUNAN_FULL_MARKETING_BLUEPRINT.distReviewConfig,
      minOrderAmount: new Decimal(HUNAN_FULL_MARKETING_BLUEPRINT.distReviewConfig.minOrderAmount),
      updateBy: 'seed',
    },
    create: {
      tenantId: HUNAN_FULL_TENANT_ID,
      ...HUNAN_FULL_MARKETING_BLUEPRINT.distReviewConfig,
      minOrderAmount: new Decimal(HUNAN_FULL_MARKETING_BLUEPRINT.distReviewConfig.minOrderAmount),
      createBy: 'seed',
      updateBy: 'seed',
    },
  });

  for (const rule of HUNAN_FULL_MARKETING_BLUEPRINT.activityPriorityRules) {
    await prisma.mktActivityPriorityRule.upsert({
      where: {
        tenantId_activityType: {
          tenantId: HUNAN_FULL_TENANT_ID,
          activityType: rule.activityType,
        },
      },
      update: rule,
      create: {
        tenantId: HUNAN_FULL_TENANT_ID,
        ...rule,
      },
    });
  }

  console.log('  ✓ 默认分佣、分销等级、审核规则');
}
