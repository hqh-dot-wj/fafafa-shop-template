import { PrismaClient } from '@prisma/client';

import { seedHunanActivityCenter } from './hunan-activity-center';
import { seedHunanMarketing } from './hunan-marketing';
import { seedHunanTenantProducts } from './hunan-tenant-products';
import { seedTenantMarketing } from './tenant-marketing';
import { seedTenantProducts } from './tenant-products';

export async function seedTenantSelection(prisma: PrismaClient) {
  await seedTenantProducts(prisma);
  await seedTenantMarketing(prisma);
  await seedHunanTenantProducts(prisma);
  await seedHunanMarketing(prisma);
  await seedHunanActivityCenter(prisma);
}
