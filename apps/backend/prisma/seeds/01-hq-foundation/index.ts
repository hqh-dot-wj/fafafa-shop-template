import { PrismaClient } from '@prisma/client';

import { seedCategories } from './categories';
import { seedBrands } from './brands';
import { seedAttrTemplates } from './attr-templates';
import { seedProducts } from './products';
import { seedPlayDefinitions } from './play-definitions';
import { seedPlayTemplates } from './play-templates';
import { seedHunanRetailProducts } from './products-hunan-retail';
import { seedHunanInstantProducts } from './products-hunan-instant';
import { seedHunanServiceProducts } from './products-hunan-service';

export async function seedHqFoundation(prisma: PrismaClient) {
  await seedCategories(prisma);
  await seedBrands(prisma);
  await seedAttrTemplates(prisma);
  await seedProducts(prisma);
  await seedPlayDefinitions(prisma);
  await seedPlayTemplates(prisma);
  await seedHunanRetailProducts(prisma);
  await seedHunanInstantProducts(prisma);
  await seedHunanServiceProducts(prisma);
}
