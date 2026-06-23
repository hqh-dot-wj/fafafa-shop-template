import { PrismaClient } from '@prisma/client';

import { seedHunanScenes } from './hunan-scenes';
import { seedDefaultModules } from './modules';
import { seedDefaultPolicies } from './policies';
import { seedDefaultReleases } from './releases';
import { seedDefaultScenes } from './scenes';
import { seedSceneTemplates } from './scene-templates';

export async function seedMarketingScenes(prisma: PrismaClient) {
  console.log('\n  [06] 营销场景种子...');
  await seedDefaultPolicies(prisma);
  await seedSceneTemplates(prisma);
  await seedDefaultScenes(prisma);
  await seedDefaultModules(prisma);
  await seedDefaultReleases(prisma);
  await seedHunanScenes(prisma);
}
