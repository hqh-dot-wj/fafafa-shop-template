import { DelFlag, Prisma, PrismaClient, ProductType, PublishStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_TENANT_ID, assertHunanFullSeedScope } from '../hunan-full/shared';

export const ACC_TENANT_ID = HUNAN_FULL_TENANT_ID;
export const ACC_RESOLVER = 'DEFAULT_RESOLVER';
export const ACC_CARD = 'SYS_DEFAULT_CARD_SIMPLE';

export const ACC_PRODUCT_PLAIN_ID = 'acc-product-plain-001';
export const ACC_SKU_PLAIN_ID = 'acc-product-plain-001-sku-1';

/** 绘画拼课：仅 sku-1 参与（与 catalog-marketing 一致，可幂等修补旧库） */
export async function patchArtCourseGroupSkuPrices(prisma: PrismaClient): Promise<void> {
  const configId = 'hf-config-course-art';
  const existing = await prisma.storePlayConfig.findUnique({ where: { id: configId } });
  if (!existing) return;

  const rules = (existing.rules as Record<string, unknown>) ?? {};
  const skuPrices = {
    'hf-service-art-001-sku-1': { price: 799, originalPrice: 980, activityPrice: 799 },
  };
  const current = rules.skuPrices as Record<string, unknown> | undefined;
  if (current && JSON.stringify(current) === JSON.stringify(skuPrices)) {
    return;
  }

  await prisma.storePlayConfig.update({
    where: { id: configId },
    data: {
      rules: {
        ...rules,
        skuPrices,
      } as Prisma.InputJsonValue,
    },
  });
  console.log('  ✓ [Acceptance] 已修补 hf-config-course-art.skuPrices（仅小班8课时 SKU）');
}

export async function assertAcceptancePrerequisites(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'acceptance-profile');
  const config = await prisma.storePlayConfig.findUnique({ where: { id: 'hf-config-course-art' } });
  if (!config) {
    throw new Error('[Acceptance] 缺少 hf-config-course-art，请先执行 hunan-full 种子');
  }
}

export async function upsertSourcePolicy(
  prisma: PrismaClient,
  policyCode: string,
  policyName: string,
  productIds: string[],
): Promise<void> {
  const config = { productIds } as Prisma.InputJsonValue;
  await prisma.mktPolicy.upsert({
    where: { tenantId_policyCode: { tenantId: ACC_TENANT_ID, policyCode } },
    update: { policyName, policyType: 'SOURCE', status: 'ACTIVE', config },
    create: {
      tenantId: ACC_TENANT_ID,
      policyCode,
      policyName,
      policyType: 'SOURCE',
      config,
      status: 'ACTIVE',
    },
  });
}

export async function upsertScene(prisma: PrismaClient, sceneCode: string, sceneName: string): Promise<void> {
  await prisma.mktScene.upsert({
    where: { tenantId_sceneCode: { tenantId: ACC_TENANT_ID, sceneCode } },
    update: { sceneName, status: 'ACTIVE', channelScope: ['MINIAPP'], sceneType: 'HOME' },
    create: {
      tenantId: ACC_TENANT_ID,
      sceneCode,
      sceneName,
      status: 'ACTIVE',
      channelScope: ['MINIAPP'],
      sceneType: 'HOME',
    },
  });
}

export async function upsertSceneModule(
  prisma: PrismaClient,
  sceneCode: string,
  moduleCode: string,
  moduleName: string,
  sourcePolicyCode: string,
  uiConfig?: Record<string, unknown>,
): Promise<void> {
  await prisma.mktSceneModule.upsert({
    where: {
      tenantId_sceneCode_moduleCode: { tenantId: ACC_TENANT_ID, sceneCode, moduleCode },
    },
    update: {
      moduleName,
      moduleType: 'PRODUCT_LIST',
      displayOrder: 1,
      limitSize: 12,
      sourcePolicyCode,
      resolverPolicyCode: ACC_RESOLVER,
      cardTemplateCode: 'PRODUCT_CARD',
      status: 'ACTIVE',
      uiConfig: (uiConfig ?? { featuredCount: 3 }) as Prisma.InputJsonValue,
    },
    create: {
      tenantId: ACC_TENANT_ID,
      sceneCode,
      moduleCode,
      moduleName,
      moduleType: 'PRODUCT_LIST',
      displayOrder: 1,
      limitSize: 12,
      sourcePolicyCode,
      resolverPolicyCode: ACC_RESOLVER,
      cardTemplateCode: 'PRODUCT_CARD',
      status: 'ACTIVE',
      uiConfig: (uiConfig ?? { featuredCount: 3 }) as Prisma.InputJsonValue,
    },
  });
}

export async function publishAcceptanceScene(prisma: PrismaClient, sceneCode: string): Promise<void> {
  const sceneWithModules = await prisma.mktScene.findUnique({
    where: { tenantId_sceneCode: { tenantId: ACC_TENANT_ID, sceneCode } },
    include: { modules: { where: { status: 'ACTIVE' }, orderBy: { displayOrder: 'asc' } } },
  });
  if (!sceneWithModules) return;

  const releaseSnapshot = {
    sceneCode: sceneWithModules.sceneCode,
    sceneName: sceneWithModules.sceneName,
    sceneType: sceneWithModules.sceneType,
    channelScope: sceneWithModules.channelScope,
    pageRoute: sceneWithModules.pageRoute,
    modules: sceneWithModules.modules.map((m) => ({
      moduleCode: m.moduleCode,
      moduleName: m.moduleName,
      moduleType: m.moduleType,
      displayOrder: m.displayOrder,
      limitSize: m.limitSize,
      sourcePolicyCode: m.sourcePolicyCode,
      resolverPolicyCode: m.resolverPolicyCode,
      sortPolicyCode: m.sortPolicyCode,
      audiencePolicyCode: m.audiencePolicyCode,
      cardTemplateCode: m.cardTemplateCode,
      uiConfig: m.uiConfig,
    })),
  };

  await prisma.mktSceneRelease.upsert({
    where: { tenantId_sceneCode_releaseNo: { tenantId: ACC_TENANT_ID, sceneCode, releaseNo: 1 } },
    update: { releaseSnapshot, releaseStatus: 'PUBLISHED', publishedAt: new Date() },
    create: {
      tenantId: ACC_TENANT_ID,
      sceneCode,
      releaseNo: 1,
      releaseStatus: 'PUBLISHED',
      releaseSnapshot,
      publishedBy: 'acceptance-seed',
      publishedAt: new Date(),
    },
  });
}

export async function seedAcceptancePlainProduct(prisma: PrismaClient): Promise<void> {
  const mainImage = 'https://nest-admin.oss-cn-beijing.aliyuncs.com/2026/04/17/hunan-full-retail-cleaner-001.png';

  await prisma.pmsProduct.upsert({
    where: { productId: ACC_PRODUCT_PLAIN_ID },
    update: {
      categoryId: 101,
      brandId: 1,
      name: '验收用普通商品（无玩法）',
      subTitle: '剧本4：仅上架，不绑定 StorePlayConfig',
      mainImages: [mainImage],
      detailHtml: '<p>验收专用</p>',
      type: ProductType.REAL,
      weight: 500,
      isFreeShip: true,
      specDef: { specs: [{ name: '规格', values: ['默认'] }] } as Prisma.InputJsonValue,
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
    },
    create: {
      productId: ACC_PRODUCT_PLAIN_ID,
      categoryId: 101,
      brandId: 1,
      name: '验收用普通商品（无玩法）',
      subTitle: '剧本4：仅上架，不绑定 StorePlayConfig',
      mainImages: [mainImage],
      detailHtml: '<p>验收专用</p>',
      type: ProductType.REAL,
      weight: 500,
      isFreeShip: true,
      specDef: { specs: [{ name: '规格', values: ['默认'] }] } as Prisma.InputJsonValue,
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
    },
  });

  await prisma.pmsGlobalSku.upsert({
    where: { skuId: ACC_SKU_PLAIN_ID },
    update: {
      productId: ACC_PRODUCT_PLAIN_ID,
      specValues: { 规格: '默认' },
      skuImage: mainImage,
      guidePrice: new Decimal(29.9),
      distMode: 'RATIO',
      guideRate: new Decimal(1),
      minDistRate: new Decimal(0.05),
      maxDistRate: new Decimal(1),
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
    },
    create: {
      skuId: ACC_SKU_PLAIN_ID,
      productId: ACC_PRODUCT_PLAIN_ID,
      specValues: { 规格: '默认' },
      skuImage: mainImage,
      guidePrice: new Decimal(29.9),
      distMode: 'RATIO',
      guideRate: new Decimal(1),
      minDistRate: new Decimal(0.05),
      maxDistRate: new Decimal(1),
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
    },
  });

  await prisma.pmsTenantProduct.upsert({
    where: {
      tenantId_productId: { tenantId: ACC_TENANT_ID, productId: ACC_PRODUCT_PLAIN_ID },
    },
    update: {
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
      price: new Decimal(28.9),
    },
    create: {
      tenantId: ACC_TENANT_ID,
      productId: ACC_PRODUCT_PLAIN_ID,
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
      price: new Decimal(28.9),
    },
  });

  await prisma.pmsTenantSku.upsert({
    where: {
      tenantId_skuId: { tenantId: ACC_TENANT_ID, skuId: ACC_SKU_PLAIN_ID },
    },
    update: {
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
      price: new Decimal(28.9),
      stock: 99,
    },
    create: {
      tenantId: ACC_TENANT_ID,
      skuId: ACC_SKU_PLAIN_ID,
      productId: ACC_PRODUCT_PLAIN_ID,
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
      price: new Decimal(28.9),
      stock: 99,
    },
  });
}
