import { DelFlag, Prisma, PrismaClient, ProductType, PublishStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { HUNAN_FULL_PRODUCTS } from '../hunan-full/catalog-products';
import type { HunanProductBlueprint, HunanProductTheme } from '../hunan-full/types';

async function upsertProduct(prisma: PrismaClient, product: HunanProductBlueprint): Promise<void> {
  await prisma.pmsProduct.upsert({
    where: { productId: product.productId },
    update: {
      categoryId: product.categoryId,
      brandId: product.brandId,
      name: product.name,
      subTitle: product.subTitle,
      mainImages: [product.mainImage],
      detailHtml: `<h2>${product.name}</h2><p>${product.subTitle}</p>`,
      type: product.type === 'REAL' ? ProductType.REAL : ProductType.SERVICE,
      weight: product.type === 'REAL' ? product.weight ?? 0 : 0,
      serviceDuration: product.type === 'SERVICE' ? product.serviceDuration ?? null : null,
      serviceRadius: product.type === 'SERVICE' ? product.serviceRadius ?? null : null,
      needBooking: product.type === 'SERVICE' ? product.needBooking ?? true : false,
      isFreeShip: product.isFreeShip,
      specDef: { specs: product.specs } as unknown as Prisma.InputJsonValue,
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
    },
    create: {
      productId: product.productId,
      categoryId: product.categoryId,
      brandId: product.brandId,
      name: product.name,
      subTitle: product.subTitle,
      mainImages: [product.mainImage],
      detailHtml: `<h2>${product.name}</h2><p>${product.subTitle}</p>`,
      type: product.type === 'REAL' ? ProductType.REAL : ProductType.SERVICE,
      weight: product.type === 'REAL' ? product.weight ?? 0 : 0,
      serviceDuration: product.type === 'SERVICE' ? product.serviceDuration ?? null : null,
      serviceRadius: product.type === 'SERVICE' ? product.serviceRadius ?? null : null,
      needBooking: product.type === 'SERVICE' ? product.needBooking ?? true : false,
      isFreeShip: product.isFreeShip,
      specDef: { specs: product.specs } as unknown as Prisma.InputJsonValue,
      publishStatus: PublishStatus.ON_SHELF,
      delFlag: DelFlag.NORMAL,
    },
  });

  await prisma.pmsProductAttrValue.deleteMany({
    where: { productId: product.productId },
  });

  if (product.attrValues.length > 0) {
    await prisma.pmsProductAttrValue.createMany({
      data: product.attrValues.map(attrValue => ({
        productId: product.productId,
        attrId: attrValue.attrId,
        attrName: attrValue.attrName,
        value: attrValue.value,
      })),
    });
  }

  await prisma.pmsGlobalSku.deleteMany({
    where: {
      productId: product.productId,
      skuId: { notIn: product.skus.map(sku => sku.skuId) },
    },
  });

  for (const sku of product.skus) {
    await prisma.pmsGlobalSku.upsert({
      where: { skuId: sku.skuId },
      update: {
        productId: product.productId,
        specValues: sku.specValues,
        skuImage: product.mainImage,
        guidePrice: new Decimal(sku.guidePrice),
        distMode: sku.distMode,
        guideRate: new Decimal(1),
        minDistRate: new Decimal(0.05),
        maxDistRate: new Decimal(1),
        costPrice: new Decimal(sku.costPrice),
      },
      create: {
        skuId: sku.skuId,
        productId: product.productId,
        specValues: sku.specValues,
        skuImage: product.mainImage,
        guidePrice: new Decimal(sku.guidePrice),
        distMode: sku.distMode,
        guideRate: new Decimal(1),
        minDistRate: new Decimal(0.05),
        maxDistRate: new Decimal(1),
        costPrice: new Decimal(sku.costPrice),
      },
    });
  }
}

export async function seedHunanProductsByTheme(
  prisma: PrismaClient,
  theme: HunanProductTheme,
  label: string,
): Promise<void> {
  const products = HUNAN_FULL_PRODUCTS.filter(product => product.theme === theme);

  console.log(`[01-HQ] 湖南完整演示商品(${label})...`);
  for (const product of products) {
    await upsertProduct(prisma, product);
  }
  console.log(`  ✓ ${products.length} 个商品，${products.flatMap(product => product.skus).length} 个 SKU`);
}
