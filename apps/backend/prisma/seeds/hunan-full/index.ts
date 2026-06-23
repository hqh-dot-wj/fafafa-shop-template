import type { PrismaClient } from '@prisma/client';

import { seedHunanRetailProducts } from '../01-hq-foundation/products-hunan-retail';
import { seedHunanInstantProducts } from '../01-hq-foundation/products-hunan-instant';
import { seedHunanServiceProducts } from '../01-hq-foundation/products-hunan-service';
import { seedHunanDistributionGovernance } from '../02-system-config/hunan-distribution-governance';
import { seedHunanOperators } from '../03-tenants/hunan-operators';
import { seedHunanActivityCenter } from '../04-tenant-selection/hunan-activity-center';
import { seedHunanMarketing } from '../04-tenant-selection/hunan-marketing';
import { seedHunanTenantProducts } from '../04-tenant-selection/hunan-tenant-products';
import { seedHunanDistributors } from '../05-c-end/hunan-distributors';
import { seedHunanMemberAssets } from '../05-c-end/hunan-member-assets';
import { seedHunanMemberLedger } from '../05-c-end/hunan-member-ledger';
import { seedHunanMembers } from '../05-c-end/hunan-members';
import { seedHunanScenes } from '../06-marketing-scenes/hunan-scenes';
import { seedOrderSimulation } from '../07-order-simulation';
import { seedCampaignCutover } from '../08-campaign-cutover';
import { setupCourseGroupTeams } from '../setup/setup-course-group-teams';
import { patchArtCourseGroupSkuPrices } from '../acceptance/shared';

export async function seedHunanFullScenario(prisma: PrismaClient): Promise<void> {
  await seedHunanRetailProducts(prisma);
  await seedHunanInstantProducts(prisma);
  await seedHunanServiceProducts(prisma);
  await seedHunanDistributionGovernance(prisma);
  await seedHunanOperators(prisma);
  await seedHunanTenantProducts(prisma);
  await seedHunanMarketing(prisma);
  await patchArtCourseGroupSkuPrices(prisma);
  await seedHunanActivityCenter(prisma);
  await seedHunanMembers(prisma);
  await seedHunanDistributors(prisma);
  await seedHunanMemberAssets(prisma);
  await seedHunanMemberLedger(prisma);
  await seedHunanScenes(prisma);
  await seedOrderSimulation(prisma);
  await seedCampaignCutover(prisma);
  await setupCourseGroupTeams(prisma);
}
