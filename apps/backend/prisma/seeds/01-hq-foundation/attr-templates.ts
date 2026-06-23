/**
 * 属性模板入口：旧演示与新零售分文件维护，见 `attr-templates-legacy-demo.ts`、`attr-templates-new-retail.ts`
 */
import type { PrismaClient } from '@prisma/client';

import { seedAttrTemplatesLegacyDemo } from './attr-templates-legacy-demo';
import { seedAttrTemplatesNewRetail } from './attr-templates-new-retail';

export async function seedAttrTemplates(prisma: PrismaClient): Promise<void> {
  console.log('[01-HQ] 属性模板与属性...');
  await seedAttrTemplatesLegacyDemo(prisma);
  await seedAttrTemplatesNewRetail(prisma);
}
