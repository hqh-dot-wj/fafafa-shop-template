/**
 * 总部商品分类入口：旧演示与新零售分文件维护，见 `categories-legacy-demo.ts`、`categories-new-retail.ts`
 */
import type { PrismaClient } from '@prisma/client';

import { seedCategoriesLegacyDemo } from './categories-legacy-demo';
import { seedCategoriesNewRetail } from './categories-new-retail';

export async function seedCategories(prisma: PrismaClient): Promise<void> {
  await seedCategoriesLegacyDemo(prisma);
  await seedCategoriesNewRetail(prisma);
}
