import { PrismaClient } from '@prisma/client';

import { seedDistConfig } from './dist-config';
import { seedHunanDistributionGovernance } from './hunan-distribution-governance';

export async function seedSystemConfig(prisma: PrismaClient) {
  await seedDistConfig(prisma);
  await seedHunanDistributionGovernance(prisma);
}
