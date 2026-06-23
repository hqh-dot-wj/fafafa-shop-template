/**
 * 将源租户的「选品 + 门店营销配置 + 活动优先级 + 积分/分佣」复制到目标租户，
 * 便于本地/测试环境让指定租户（如 100006）具备 C 端营销聚合等接口所需数据。
 *
 * 运行（在 apps/backend 目录，需已配置 DATABASE_URL）:
 *   pnpm exec ts-node scripts/seed/sync-tenant-demo-data.ts
 *   pnpm exec ts-node scripts/seed/sync-tenant-demo-data.ts -- --from=000000 --to=100006
 *
 * 说明：
 * - 若源租户无 ON_SHELF 的 store_play_config，会提示先跑模拟流或从后台创建活动。
 * - 目标租户须已在 sys_tenant 中存在（可先执行 prisma seed 或手动开通租户）。
 */
import { PrismaClient, DelFlag, PublishStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();

function parseArg(name: string, defaultValue: string): string {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : defaultValue;
}

async function ensureTargetTenantExists(tenantId: string): Promise<boolean> {
  const t = await prisma.sysTenant.findFirst({
    where: { tenantId, delFlag: DelFlag.NORMAL },
  });
  if (t) return true;
  console.error(`❌ 目标租户 ${tenantId} 在 sys_tenant 中不存在。请先 prisma seed 或在后台开通租户。`);
  return false;
}

async function copyTenantProducts(fromTenantId: string, toTenantId: string): Promise<number> {
  const sourceTps = await prisma.pmsTenantProduct.findMany({
    where: { tenantId: fromTenantId },
    include: { skus: true },
  });
  let created = 0;
  for (const stp of sourceTps) {
    const exists = await prisma.pmsTenantProduct.findUnique({
      where: { tenantId_productId: { tenantId: toTenantId, productId: stp.productId } },
    });
    if (exists) continue;

    const newTp = await prisma.pmsTenantProduct.create({
      data: {
        tenantId: toTenantId,
        productId: stp.productId,
        status: stp.status,
        isHot: stp.isHot,
        sort: stp.sort,
        customTitle: stp.customTitle,
        overrideRadius: stp.overrideRadius,
      },
    });
    for (const sku of stp.skus) {
      await prisma.pmsTenantSku.create({
        data: {
          tenantId: toTenantId,
          tenantProductId: newTp.id,
          globalSkuId: sku.globalSkuId,
          price: sku.price,
          stock: sku.stock,
          isActive: sku.isActive,
          distMode: sku.distMode,
          distRate: sku.distRate,
          isExchangeProduct: sku.isExchangeProduct,
          version: 0,
          pointsRatio: sku.pointsRatio,
          isPromotionProduct: sku.isPromotionProduct,
          newcomerPrice: sku.newcomerPrice,
        },
      });
    }
    created += 1;
  }
  return created;
}

async function buildSourceToTargetSkuMap(
  fromTenantId: string,
  toTenantId: string,
): Promise<Map<string, string>> {
  const fromSkus = await prisma.pmsTenantSku.findMany({
    where: { tenantId: fromTenantId },
    include: { tenantProd: { select: { productId: true } } },
  });
  const map = new Map<string, string>();
  for (const fs of fromSkus) {
    const targetTp = await prisma.pmsTenantProduct.findUnique({
      where: { tenantId_productId: { tenantId: toTenantId, productId: fs.tenantProd.productId } },
      include: { skus: { where: { globalSkuId: fs.globalSkuId } } },
    });
    const targetSku = targetTp?.skus[0];
    if (targetSku) {
      map.set(fs.id, targetSku.id);
    }
  }
  return map;
}

async function copyStorePlayConfigs(
  fromTenantId: string,
  toTenantId: string,
  skuIdMap: Map<string, string>,
): Promise<number> {
  const configs = await prisma.storePlayConfig.findMany({
    where: {
      tenantId: fromTenantId,
      delFlag: DelFlag.NORMAL,
      status: PublishStatus.ON_SHELF,
    },
    include: { targetSkus: true },
  });
  let created = 0;
  for (const c of configs) {
    const dup = await prisma.storePlayConfig.findFirst({
      where: {
        tenantId: toTenantId,
        serviceId: c.serviceId,
        templateCode: c.templateCode,
        delFlag: DelFlag.NORMAL,
      },
    });
    if (dup) continue;

    const targetCreates = c.targetSkus
      .map((ts) => {
        const tenantSkuId = skuIdMap.get(ts.tenantSkuId);
        if (!tenantSkuId) return null;
        return {
          tenantSkuId,
          globalSkuId: ts.globalSkuId,
          sort: ts.sort,
          isPrimaryDisplay: ts.isPrimaryDisplay,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (c.targetSkus.length > 0 && targetCreates.length === 0) {
      console.warn(
        `⚠ 跳过营销配置 serviceId=${c.serviceId} template=${c.templateCode}：目标租户缺少对应门店 SKU 映射`,
      );
      continue;
    }

    await prisma.storePlayConfig.create({
      data: {
        id: randomUUID(),
        tenantId: toTenantId,
        storeId: toTenantId,
        serviceId: c.serviceId,
        serviceType: c.serviceType,
        templateCode: c.templateCode,
        rules: c.rules,
        rulesHistory: c.rulesHistory,
        stockMode: c.stockMode,
        scopeType: c.scopeType,
        aggregateEnabled: c.aggregateEnabled,
        zoneEnabled: c.zoneEnabled,
        displayPriority: c.displayPriority,
        commissionMode: c.commissionMode,
        commissionRate: c.commissionRate,
        status: c.status,
        delFlag: DelFlag.NORMAL,
        targetSkus: targetCreates.length
          ? {
              create: targetCreates,
            }
          : undefined,
      },
    });
    created += 1;
  }
  return created;
}

async function copyActivityPriorityRules(fromTenantId: string, toTenantId: string): Promise<void> {
  const rules = await prisma.mktActivityPriorityRule.findMany({ where: { tenantId: fromTenantId } });
  for (const r of rules) {
    await prisma.mktActivityPriorityRule.upsert({
      where: { tenantId_activityType: { tenantId: toTenantId, activityType: r.activityType } },
      create: {
        tenantId: toTenantId,
        activityType: r.activityType,
        priority: r.priority,
        aggregateEnabled: r.aggregateEnabled,
        zoneEnabled: r.zoneEnabled,
        manualLockEnabled: r.manualLockEnabled,
      },
      update: {
        priority: r.priority,
        aggregateEnabled: r.aggregateEnabled,
        zoneEnabled: r.zoneEnabled,
        manualLockEnabled: r.manualLockEnabled,
      },
    });
  }
}

async function copyPointsAndDist(fromTenantId: string, toTenantId: string): Promise<void> {
  const points = await prisma.mktPointsRule.findUnique({ where: { tenantId: fromTenantId } });
  if (points) {
    await prisma.mktPointsRule.upsert({
      where: { tenantId: toTenantId },
      update: {},
      create: {
        tenantId: toTenantId,
        orderPointsEnabled: points.orderPointsEnabled,
        orderPointsRatio: points.orderPointsRatio,
        orderPointsBase: points.orderPointsBase,
        signinPointsEnabled: points.signinPointsEnabled,
        signinPointsAmount: points.signinPointsAmount,
        pointsValidityEnabled: points.pointsValidityEnabled,
        pointsValidityDays: points.pointsValidityDays,
        pointsRedemptionEnabled: points.pointsRedemptionEnabled,
        pointsRedemptionRatio: points.pointsRedemptionRatio,
        pointsRedemptionBase: points.pointsRedemptionBase,
        maxPointsPerOrder: points.maxPointsPerOrder,
        maxDiscountPercentOrder: points.maxDiscountPercentOrder,
        systemEnabled: points.systemEnabled,
        createBy: 'sync-tenant-demo-data',
        updateBy: null,
      },
    });
  }

  const dist = await prisma.sysDistConfig.findUnique({ where: { tenantId: fromTenantId } });
  if (dist) {
    await prisma.sysDistConfig.upsert({
      where: { tenantId: toTenantId },
      update: {},
      create: {
        tenantId: toTenantId,
        level1Rate: dist.level1Rate,
        level2Rate: dist.level2Rate,
        enableLV0: dist.enableLV0,
        enableCrossTenant: dist.enableCrossTenant,
        crossTenantRate: dist.crossTenantRate,
        crossMaxDaily: dist.crossMaxDaily,
        commissionBaseType: dist.commissionBaseType,
        maxCommissionRate: dist.maxCommissionRate,
        createBy: 'sync-tenant-demo-data',
        updateBy: 'sync-tenant-demo-data',
      },
    });
  }
}

async function pickSourceTenant(preferredFrom: string): Promise<string | null> {
  const grouped = await prisma.storePlayConfig.groupBy({
    by: ['tenantId'],
    where: { delFlag: DelFlag.NORMAL, status: PublishStatus.ON_SHELF },
    _count: { _all: true },
  });
  const hasConfigs = (tid: string) => grouped.some((g) => g.tenantId === tid && g._count._all > 0);

  if (hasConfigs(preferredFrom)) {
    return preferredFrom;
  }
  const order = ['000000', '100001', '100002', '100003', '100004', '100005'];
  for (const tid of order) {
    if (hasConfigs(tid)) return tid;
  }
  const any = grouped.find((g) => g._count._all > 0);
  return any?.tenantId ?? null;
}

async function main() {
  const toTenantId = parseArg('to', '100006');
  let fromTenantId = parseArg('from', '000000');

  console.log(`同步演示数据: 源=${fromTenantId} → 目标=${toTenantId}`);

  const ok = await ensureTargetTenantExists(toTenantId);
  if (!ok) {
    process.exitCode = 1;
    return;
  }

  const resolvedSource = await pickSourceTenant(fromTenantId);
  if (!resolvedSource) {
    console.error(
      '❌ 数据库中没有任何 ON_SHELF 的门店营销配置（mkt_store_config）。请先执行 simulate 脚本、E2E 造数，或在后台创建活动后再运行本脚本。',
    );
    process.exitCode = 1;
    return;
  }
  if (resolvedSource !== fromTenantId) {
    console.log(`ℹ 源租户 ${fromTenantId} 无上架营销配置，改用 ${resolvedSource} 作为复制源。`);
    fromTenantId = resolvedSource;
  }

  const productCount = await copyTenantProducts(fromTenantId, toTenantId);
  console.log(`✓ 选品：新增 ${productCount} 个租户商品（已存在的 productId 已跳过）`);

  const skuMap = await buildSourceToTargetSkuMap(fromTenantId, toTenantId);
  const configCount = await copyStorePlayConfigs(fromTenantId, toTenantId, skuMap);
  console.log(`✓ 营销配置：新增 ${configCount} 条 ON_SHELF 配置（同 serviceId+template 已跳过）`);

  await copyActivityPriorityRules(fromTenantId, toTenantId);
  console.log('✓ 活动优先级规则已对齐（upsert）');

  await copyPointsAndDist(fromTenantId, toTenantId);
  console.log('✓ 积分规则 / 分佣配置已对齐（存在则跳过 create）');

  console.log('\n完成。请使用 tenant-id: ' + toTenantId + ' 调用 C 端聚合接口验证。');
}

main().finally(() => prisma.$disconnect());
