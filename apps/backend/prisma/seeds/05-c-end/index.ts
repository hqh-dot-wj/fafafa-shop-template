import { PrismaClient } from '@prisma/client';

import { seedCouponsIssued } from './coupons-issued';
import { seedHunanDistributors } from './hunan-distributors';
import { seedHunanMemberAssets } from './hunan-member-assets';
import { seedHunanMembers } from './hunan-members';
import { seedMemberExtras } from './member-extras';
import { seedMemberLedgerDemo } from './member-ledger-demo';
import { seedMembers } from './members';

export async function seedCEnd(prisma: PrismaClient) {
  await seedMembers(prisma);
  await seedMemberExtras(prisma);
  await seedMemberLedgerDemo(prisma);
  await seedCouponsIssued(prisma);
  await seedHunanMembers(prisma);
  await seedHunanDistributors(prisma);
  await seedHunanMemberAssets(prisma);
}
