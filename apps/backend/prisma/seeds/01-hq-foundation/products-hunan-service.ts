import type { PrismaClient } from '@prisma/client';

import { seedHunanProductsByTheme } from './hunan-product-shared';

export async function seedHunanServiceProducts(prisma: PrismaClient): Promise<void> {
  await seedHunanProductsByTheme(prisma, 'service', '课程服务');
}
