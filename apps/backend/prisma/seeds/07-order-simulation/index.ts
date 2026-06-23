import { PrismaClient } from '@prisma/client';

import { seedHunanCommissions } from './hunan-commissions';
import { seedHunanFulfillment } from './hunan-fulfillment';
import { seedHunanMarketingObservability } from './hunan-marketing-observability';
import { seedHunanOrders } from './hunan-orders';
import { seedHunanReconciliationCenter } from './hunan-reconciliation-center';
import { seedHunanRefunds } from './hunan-refunds';
import { seedHunanSettlements } from './hunan-settlements';
import { seedHunanWithdrawals } from './hunan-withdrawals';

export async function seedOrderSimulation(prisma: PrismaClient): Promise<void> {
  await seedHunanOrders(prisma);
  await seedHunanCommissions(prisma);
  await seedHunanSettlements(prisma);
  await seedHunanRefunds(prisma);
  await seedHunanFulfillment(prisma);
  await seedHunanWithdrawals(prisma);
  await seedHunanReconciliationCenter(prisma);
  await seedHunanMarketingObservability(prisma);
}
