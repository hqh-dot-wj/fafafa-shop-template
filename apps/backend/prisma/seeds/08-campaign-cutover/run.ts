import { PrismaClient } from '@prisma/client';

import { seedCampaignCutoverFromActivity } from './migrate-activity-to-campaign';

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedCampaignCutoverFromActivity(prisma, {
      actor: process.env.SEED_ACTOR || 'deploy-cutover',
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[08-Cutover] seed failed:', error);
  process.exit(1);
});
