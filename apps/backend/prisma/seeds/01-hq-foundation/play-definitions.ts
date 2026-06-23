import { MarketingStockMode, PrismaClient } from '@prisma/client';

const PLAY_DEFINITIONS = [
  {
    code: 'COURSE_GROUP_BUY',
    name: '拼班课程',
    handlerClassName: 'CourseGroupBuyService',
    hasInstance: true,
    hasState: true,
    canFail: true,
    canParallel: true,
    defaultStockMode: MarketingStockMode.LAZY_CHECK,
    description: '课程拼团，人数达到要求后开班，需设置上课时间和地址',
  },
  {
    code: 'FLASH_SALE',
    name: '限时秒杀',
    handlerClassName: 'FlashSaleService',
    hasInstance: true,
    hasState: true,
    canFail: false,
    canParallel: false,
    defaultStockMode: MarketingStockMode.STRONG_LOCK,
    description: '限量商品先到先得，必须使用强锁定库存模式',
  },
  {
    code: 'MEMBER_UPGRADE',
    name: '会员升级',
    handlerClassName: 'MemberUpgradeService',
    hasInstance: true,
    hasState: true,
    canFail: false,
    canParallel: false,
    defaultStockMode: MarketingStockMode.LAZY_CHECK,
    description: '用户支付升级费用后提升会员等级',
  },
  {
    code: 'NEWCOMER_EXCLUSIVE',
    name: '新人专享',
    handlerClassName: 'NewcomerHandler',
    hasInstance: false,
    hasState: false,
    canFail: false,
    canParallel: false,
    defaultStockMode: MarketingStockMode.LAZY_CHECK,
    description: '新人绑定或领取后发放权益，并支持新人价覆盖',
  },
  {
    code: 'DISTRIBUTION_GROWTH',
    name: '分销成长',
    handlerClassName: 'DistributionGrowthHandler',
    hasInstance: false,
    hasState: false,
    canFail: false,
    canParallel: true,
    defaultStockMode: MarketingStockMode.LAZY_CHECK,
    description: '分销成长活动配置，由分销与佣金域执行奖励',
  },
  {
    code: 'POLICY_EVAL',
    name: '配置型营销策略',
    handlerClassName: 'PolicyEvaluatorAdapter',
    hasInstance: false,
    hasState: false,
    canFail: false,
    canParallel: true,
    defaultStockMode: MarketingStockMode.LAZY_CHECK,
    description: '配置型 campaign 的统一策略评估 sentinel',
  },
] as const;

export async function seedPlayDefinitions(prisma: PrismaClient): Promise<void> {
  console.log('[01-HQ] 玩法运行时定义...');

  for (const definition of PLAY_DEFINITIONS) {
    await prisma.playDefinition.upsert({
      where: { code: definition.code },
      update: {
        name: definition.name,
        handlerClassName: definition.handlerClassName,
        hasInstance: definition.hasInstance,
        hasState: definition.hasState,
        canFail: definition.canFail,
        canParallel: definition.canParallel,
        defaultStockMode: definition.defaultStockMode,
        description: definition.description,
        isActive: true,
      },
      create: {
        code: definition.code,
        name: definition.name,
        handlerClassName: definition.handlerClassName,
        hasInstance: definition.hasInstance,
        hasState: definition.hasState,
        canFail: definition.canFail,
        canParallel: definition.canParallel,
        defaultStockMode: definition.defaultStockMode,
        description: definition.description,
        isActive: true,
      },
    });
  }

  console.log(`  ✓ ${PLAY_DEFINITIONS.length} 个玩法运行时定义`);
}
