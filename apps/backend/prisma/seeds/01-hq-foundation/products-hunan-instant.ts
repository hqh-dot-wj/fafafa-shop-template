import type { PrismaClient } from '@prisma/client';

import { seedHunanProductsByTheme } from './hunan-product-shared';

export async function seedHunanInstantProducts(prisma: PrismaClient): Promise<void> {
  await seedHunanProductsByTheme(prisma, 'instant', '即时零售');
}
