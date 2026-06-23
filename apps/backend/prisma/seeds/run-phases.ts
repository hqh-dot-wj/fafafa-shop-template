/**
 * 业务种子阶段：总部 -> 租户 -> 选品 -> C端 -> 订单模拟
 */
import { PrismaClient } from '@prisma/client';

import { seedHqFoundation } from './01-hq-foundation';
import { seedSystemConfig } from './02-system-config';
import { seedTenantsPhase } from './03-tenants';
import { seedTenantSelection } from './04-tenant-selection';
import { seedCEnd } from './05-c-end';
import { seedMarketingScenes } from './06-marketing-scenes';
import { seedOrderSimulation } from './07-order-simulation';
import { seedCampaignCutover } from './08-campaign-cutover';

export async function runSeedPhases(prisma: PrismaClient) {
  console.log('\n--- 业务种子阶段 ---');
  await seedHqFoundation(prisma);
  await seedSystemConfig(prisma);
  await seedTenantsPhase(prisma);
  await seedTenantSelection(prisma);
  await seedMarketingScenes(prisma);
  await seedCEnd(prisma);
  await seedOrderSimulation(prisma);
  await seedCampaignCutover(prisma);
  console.log('--- 业务种子完成 ---\n');
}
