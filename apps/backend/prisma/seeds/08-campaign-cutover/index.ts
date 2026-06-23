import type { PrismaClient } from '@prisma/client';

import { seedCampaignCutoverFromActivity } from './migrate-activity-to-campaign';

export async function seedCampaignCutover(prisma: PrismaClient): Promise<void> {
  await seedCampaignCutoverFromActivity(prisma, { actor: 'seed-cutover' });
}
