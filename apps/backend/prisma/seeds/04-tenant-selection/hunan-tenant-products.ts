import { PrismaClient, PublishStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_PRODUCTS } from '../hunan-full/catalog-products';
import { assertHunanFullSeedScope, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

export async function seedHunanTenantProducts(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanTenantProducts');
  console.log('[04-Selection] 湖南完整演示选品...');

  for (const product of HUNAN_FULL_PRODUCTS) {
    const tenantProduct = await prisma.pmsTenantProduct.upsert({
      where: {
        tenantId_productId: {
          tenantId: HUNAN_FULL_TENANT_ID,
          productId: product.productId,
        },
      },
      update: {
        status: PublishStatus.ON_SHELF,
        isHot: product.isHot ?? false,
        sort: product.sort ?? 0,
        customTitle: product.customTitle ?? null,
        overrideRadius: product.type === 'SERVICE' ? product.serviceRadius ?? null : null,
      },
      create: {
        tenantId: HUNAN_FULL_TENANT_ID,
        productId: product.productId,
        status: PublishStatus.ON_SHELF,
        isHot: product.isHot ?? false,
        sort: product.sort ?? 0,
        customTitle: product.customTitle ?? null,
        overrideRadius: product.type === 'SERVICE' ? product.serviceRadius ?? null : null,
      },
    });

    await prisma.pmsTenantSku.deleteMany({
      where: {
        tenantProductId: tenantProduct.id,
        globalSkuId: { notIn: product.skus.map(sku => sku.skuId) },
      },
    });

    for (const sku of product.skus) {
      await prisma.pmsTenantSku.upsert({
        where: {
          tenantProductId_globalSkuId: {
            tenantProductId: tenantProduct.id,
            globalSkuId: sku.skuId,
          },
        },
        update: {
          tenantId: HUNAN_FULL_TENANT_ID,
          price: new Decimal(sku.tenantPrice),
          stock: sku.stock,
          isActive: true,
          distMode: sku.distMode,
          distRate: new Decimal(sku.distRate),
          isExchangeProduct: sku.isExchangeProduct ?? false,
          version: 0,
          pointsRatio: sku.pointsRatio,
          isPromotionProduct: sku.isPromotionProduct,
          newcomerPrice: sku.newcomerPrice == null ? null : new Decimal(sku.newcomerPrice),
        },
        create: {
          tenantId: HUNAN_FULL_TENANT_ID,
          tenantProductId: tenantProduct.id,
          globalSkuId: sku.skuId,
          price: new Decimal(sku.tenantPrice),
          stock: sku.stock,
          isActive: true,
          distMode: sku.distMode,
          distRate: new Decimal(sku.distRate),
          isExchangeProduct: sku.isExchangeProduct ?? false,
          version: 0,
          pointsRatio: sku.pointsRatio,
          isPromotionProduct: sku.isPromotionProduct,
          newcomerPrice: sku.newcomerPrice == null ? null : new Decimal(sku.newcomerPrice),
        },
      });
    }
  }

  console.log(`  ✓ ${HUNAN_FULL_PRODUCTS.length} 个商品完成租户选品`);
}
