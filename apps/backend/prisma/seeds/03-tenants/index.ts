import { PrismaClient } from '@prisma/client';

import { seedAiPlatformPrompts } from '../01-hq-foundation/ai-platform-prompts';
import { seedHunanOperators } from './hunan-operators';
import { seedTenants } from './tenants';
import { seedDemoTenantAdminPermissions } from './sync-demo-tenant-permissions';

export async function seedTenantsPhase(prisma: PrismaClient) {
  await seedTenants(prisma);
  await seedAiPlatformPrompts(prisma);
  await seedHunanOperators(prisma);
  await seedDemoTenantAdminPermissions(prisma);
}
