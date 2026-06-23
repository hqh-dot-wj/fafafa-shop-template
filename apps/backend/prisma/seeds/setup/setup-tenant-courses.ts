import { PrismaClient, PublishStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 为指定租户设置课程商品
 *
 * 功能：
 * 1. 下架租户所有现有商品
 * 2. 为租户上架所有课程商品
 * 3. 为每个课程商品创建租户 SKU
 */

const TENANT_ID = '000000';

async function main() {
  console.log(`🏪 为租户 ${TENANT_ID} 设置课程商品...\n`);

  // ==========================================
  // 第一步：下架所有现有商品
  // ==========================================
  console.log('📦 第一步：下架所有现有商品...\n');

  const existingProducts = await prisma.pmsTenantProduct.findMany({
    where: { tenantId: TENANT_ID },
  });

  console.log(`   发现 ${existingProducts.length} 个现有商品`);

  if (existingProducts.length > 0) {
    const updateResult = await prisma.pmsTenantProduct.updateMany({
      where: { tenantId: TENANT_ID },
      data: { status: PublishStatus.OFF_SHELF },
    });

    console.log(`   ✅ 已下架 ${updateResult.count} 个商品\n`);
  } else {
    console.log('   ℹ️  没有现有商品需要下架\n');
  }

  // ==========================================
  // 第二步：获取所有课程商品
  // ==========================================
  console.log('📚 第二步：获取所有课程商品...\n');

  const courseProducts = await prisma.pmsProduct.findMany({
    where: {
      productId: { startsWith: 'course-' },
      publishStatus: PublishStatus.ON_SHELF,
    },
    include: {
      globalSkus: true,
    },
  });

  console.log(`   找到 ${courseProducts.length} 个课程商品\n`);

  // ==========================================
  // 第三步：为租户上架课程商品
  // ==========================================
  console.log('🔼 第三步：为租户上架课程商品...\n');

  let productCount = 0;
  let skuCount = 0;

  for (const product of courseProducts) {
    try {
      // 创建租户商品
      const tenantProduct = await prisma.pmsTenantProduct.upsert({
        where: {
          tenantId_productId: {
            tenantId: TENANT_ID,
            productId: product.productId,
          },
        },
        update: {
          status: PublishStatus.ON_SHELF,
        },
        create: {
          tenantId: TENANT_ID,
          productId: product.productId,
          status: PublishStatus.ON_SHELF,
        },
      });

      productCount++;
      console.log(`   ✅ ${product.name}`);

      // 为每个 SKU 创建租户 SKU
      for (const globalSku of product.globalSkus) {
        try {
          await prisma.pmsTenantSku.upsert({
            where: {
              id: `${tenantProduct.id}-${globalSku.skuId}`,
            },
            update: {
              price: Number(globalSku.guidePrice),
              isActive: true,
            },
            create: {
              id: `${tenantProduct.id}-${globalSku.skuId}`,
              tenantId: TENANT_ID,
              tenantProductId: tenantProduct.id,
              globalSkuId: globalSku.skuId,
              price: Number(globalSku.guidePrice),
              stock: 0, // 服务类商品无库存
              isActive: true,
              distMode: 'RATIO',
              distRate: 0,
            },
          });
          skuCount++;
        } catch (error: any) {
          console.error(`      ❌ SKU ${globalSku.skuId} 失败:`, error.message);
        }
      }
    } catch (error: any) {
      console.error(`   ❌ ${product.name} 失败:`, error.message);
    }
  }

  console.log(`\n   成功上架 ${productCount} 个商品，${skuCount} 个 SKU\n`);

  // ==========================================
  // 第四步：验证结果
  // ==========================================
  console.log('🔍 第四步：验证结果...\n');

  const stats = {
    totalProducts: await prisma.pmsTenantProduct.count({
      where: { tenantId: TENANT_ID },
    }),
    onShelfProducts: await prisma.pmsTenantProduct.count({
      where: {
        tenantId: TENANT_ID,
        status: PublishStatus.ON_SHELF,
      },
    }),
    offShelfProducts: await prisma.pmsTenantProduct.count({
      where: {
        tenantId: TENANT_ID,
        status: PublishStatus.OFF_SHELF,
      },
    }),
    totalSkus: await prisma.pmsTenantSku.count({
      where: {
        tenantId: TENANT_ID,
      },
    }),
  };

  console.log('📊 租户商品统计：');
  console.log(`   总商品数: ${stats.totalProducts} 个`);
  console.log(`   已上架: ${stats.onShelfProducts} 个`);
  console.log(`   已下架: ${stats.offShelfProducts} 个`);
  console.log(`   总 SKU 数: ${stats.totalSkus} 个\n`);

  // 显示已上架的课程商品
  const onShelfCourses = await prisma.pmsTenantProduct.findMany({
    where: {
      tenantId: TENANT_ID,
      status: PublishStatus.ON_SHELF,
      productId: { startsWith: 'course-' },
    },
    include: {
      product: true,
      skus: true,
    },
  });

  console.log('📋 已上架的课程商品：\n');
  onShelfCourses.forEach((tp, index) => {
    console.log(`   ${index + 1}. ${tp.product.name}`);
    console.log(`      商品ID: ${tp.productId}`);
    console.log(`      SKU数: ${tp.skus.length} 个`);
    console.log('');
  });

  console.log('🎉 租户课程商品设置完成！\n');
}

main()
  .catch((e) => {
    console.error('\n❌ 脚本执行失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
