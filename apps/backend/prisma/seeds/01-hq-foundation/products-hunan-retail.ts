import type { PrismaClient } from '@prisma/client';

import { seedHunanProductsByTheme } from './hunan-product-shared';

export async function seedHunanRetailProducts(prisma: PrismaClient): Promise<void> {
  await seedHunanProductsByTheme(prisma, 'retail', '到店零售');
}
