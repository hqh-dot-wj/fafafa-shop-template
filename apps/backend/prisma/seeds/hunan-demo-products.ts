import { DelFlag, PrismaClient, ProductType, PublishStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const HUNAN_DEMO_PRODUCT_FRUIT_ID = 'd289ea7e-4d67-40cb-820c-1119c98aa16f';
export const HUNAN_DEMO_PRODUCT_DRINK_ID = '8dd0a7fb-ced4-4849-88d8-272378a477b4';

const PRODUCTS = [
  {
    productId: HUNAN_DEMO_PRODUCT_FRUIT_ID,
    categoryId: 41,
    name: '云南蓝莓鲜果盒',
    subTitle: '当季鲜果，门店冷链优先发货',
    weight: 1000,
    specs: [{ name: '规格', values: ['125g*2盒', '125g*4盒'] }],
    skus: [
      {
        skuId: `${HUNAN_DEMO_PRODUCT_FRUIT_ID}-0`,
        specValues: { 规格: '125g*2盒' },
        guidePrice: 29.9,
        costPrice: 18,
      },
      {
        skuId: `${HUNAN_DEMO_PRODUCT_FRUIT_ID}-1`,
        specValues: { 规格: '125g*4盒' },
        guidePrice: 49.9,
        costPrice: 32,
      },
    ],
  },
  {
    productId: HUNAN_DEMO_PRODUCT_DRINK_ID,
    categoryId: 36,
    name: 'if 100%椰子水',
    subTitle: 'NFC 椰子水，适合秒杀联调',
    weight: 1200,
    specs: [{ name: '规格', values: ['350ml*6瓶', '1L*2瓶'] }],
    skus: [
      {
        skuId: `${HUNAN_DEMO_PRODUCT_DRINK_ID}-0`,
        specValues: { 规格: '350ml*6瓶' },
        guidePrice: 39.9,
        costPrice: 24,
      },
      {
        skuId: `${HUNAN_DEMO_PRODUCT_DRINK_ID}-1`,
        specValues: { 规格: '1L*2瓶' },
        guidePrice: 29.9,
        costPrice: 17,
      },
    ],
  },
] as const;

const IMG_MAP: Record<string, string> = {
  [HUNAN_DEMO_PRODUCT_FRUIT_ID]:
    'https://nest-admin.oss-cn-beijing.aliyuncs.com/2026/04/16/demo-fruit-blueberry.png',
  [HUNAN_DEMO_PRODUCT_DRINK_ID]:
    'https://nest-admin.oss-cn-beijing.aliyuncs.com/2026/04/16/demo-drink-coconut-water.png',
};

export async function seedHunanDemoProducts(prisma: PrismaClient): Promise<void> {
  console.log('[Hunan-Marketing] 初始化 demo 商品...');

  for (const item of PRODUCTS) {
    const mainImage = IMG_MAP[item.productId];

    await prisma.pmsProduct.upsert({
      where: { productId: item.productId },
      update: {
        categoryId: item.categoryId,
        brandId: null,
        name: item.name,
        subTitle: item.subTitle,
        mainImages: [mainImage],
        detailHtml: `<h2>${item.name}</h2><p>${item.subTitle}</p>`,
        type: ProductType.REAL,
        weight: item.weight,
        isFreeShip: false,
        specDef: { specs: item.specs },
        publishStatus: PublishStatus.ON_SHELF,
        delFlag: DelFlag.NORMAL,
      },
      create: {
        productId: item.productId,
        categoryId: item.categoryId,
        brandId: null,
        name: item.name,
        subTitle: item.subTitle,
        mainImages: [mainImage],
        detailHtml: `<h2>${item.name}</h2><p>${item.subTitle}</p>`,
        type: ProductType.REAL,
        weight: item.weight,
        isFreeShip: false,
        specDef: { specs: item.specs },
        publishStatus: PublishStatus.ON_SHELF,
        delFlag: DelFlag.NORMAL,
      },
    });

    await prisma.pmsGlobalSku.deleteMany({
      where: {
        productId: item.productId,
        skuId: { notIn: item.skus.map(sku => sku.skuId) },
      },
    });

    for (const sku of item.skus) {
      await prisma.pmsGlobalSku.upsert({
        where: { skuId: sku.skuId },
        update: {
          specValues: sku.specValues,
          skuImage: mainImage,
          guidePrice: new Decimal(sku.guidePrice),
          distMode: 'RATIO',
          guideRate: new Decimal(1),
          minDistRate: new Decimal(0.05),
          maxDistRate: new Decimal(1),
          costPrice: new Decimal(sku.costPrice),
        },
        create: {
          skuId: sku.skuId,
          productId: item.productId,
          specValues: sku.specValues,
          skuImage: mainImage,
          guidePrice: new Decimal(sku.guidePrice),
          distMode: 'RATIO',
          guideRate: new Decimal(1),
          minDistRate: new Decimal(0.05),
          maxDistRate: new Decimal(1),
          costPrice: new Decimal(sku.costPrice),
        },
      });
    }
  }

  console.log(`[Hunan-Marketing] ✓ demo 商品 ${PRODUCTS.length} 个`);
}
