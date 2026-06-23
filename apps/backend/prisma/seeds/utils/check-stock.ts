import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const skus = await prisma.pmsTenantSku.findMany({
    where: { tenantId: '000000' },
    select: { globalSkuId: true, stock: true, isActive: true, price: true },
    orderBy: { globalSkuId: 'asc' },
  });

  console.log('Total tenant SKUs:', skus.length);
  const zeroStock = skus.filter((s) => s.stock === 0);
  const hasStock = skus.filter((s) => s.stock > 0);
  const inactive = skus.filter((s) => !s.isActive);

  console.log('Zero stock:', zeroStock.length);
  console.log('Has stock:', hasStock.length);
  console.log('Inactive:', inactive.length);

  console.log('\n--- ALL SKUs ---');
  for (const s of skus) {
    const flag = s.stock === 0 ? ' ❌' : ' ✅';
    console.log(`${s.globalSkuId}  stock=${s.stock}  active=${s.isActive}  price=${s.price}${flag}`);
  }

  // Check specific products
  console.log('\n--- Basketball product tenant product ---');
  const bball = await prisma.pmsTenantProduct.findFirst({
    where: { tenantId: '000000', productId: 'hf-service-basketball-001' },
    include: { skus: true },
  });
  if (bball) {
    console.log('Status:', bball.status, 'ID:', bball.id);
    for (const sku of bball.skus) {
      console.log(`  ${sku.globalSkuId}  stock=${sku.stock}  active=${sku.isActive}  price=${sku.price}`);
    }
  } else {
    console.log('NOT FOUND');
  }

  console.log('\n--- Coconut water tenant product ---');
  const coconut = await prisma.pmsTenantProduct.findFirst({
    where: { tenantId: '000000', productId: 'hf-instant-coconut-water-001' },
    include: { skus: true },
  });
  if (coconut) {
    console.log('Status:', coconut.status, 'ID:', coconut.id);
    for (const sku of coconut.skus) {
      console.log(`  ${sku.globalSkuId}  stock=${sku.stock}  active=${sku.isActive}  price=${sku.price}`);
    }
  } else {
    console.log('NOT FOUND');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
