import { OrderStatus, PrismaClient } from '@prisma/client';

import {
  FULFILLMENT_BACKFILL_CONFIRMATION,
  LegacyFulfillmentBackfillRunner,
} from '../../../src/module/fulfillment/services/legacy-fulfillment-backfill.runner';
import { assertHunanFullSeedScope, HUNAN_FULL_TENANT_ID } from '../hunan-full/shared';

const HF_FULFILLMENT_RUN_ID = 'hf-seed-fulfillment-202604';

/**
 * 为湖南演示已支付实物/服务订单补齐履约单（幂等：runner 跳过已存在行项）。
 */
export async function seedHunanFulfillment(prisma: PrismaClient): Promise<void> {
  await assertHunanFullSeedScope(prisma, 'seedHunanFulfillment');
  console.log('[07-Orders] 湖南完整演示履约单回填...');

  const runner = new LegacyFulfillmentBackfillRunner(prisma);
  const result = await runner.run({
    apply: true,
    tenantId: HUNAN_FULL_TENANT_ID,
    statuses: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.COMPLETED],
    orderSn: 'HF-ORDER',
    limit: 500,
    runId: HF_FULFILLMENT_RUN_ID,
    confirmApply: FULFILLMENT_BACKFILL_CONFIRMATION,
  });

  const applied = result.applyResults.filter((row) => row.action === 'APPLIED').length;
  const skipped = result.applyResults.filter((row) => row.action === 'SKIPPED').length;
  const review = result.applyResults.filter((row) => row.action === 'REVIEW_REQUIRED').length;

  console.log(
    `  ✓ 履约回填：新增 ${result.summary.createdFulfillmentCount} 单，` +
      `事件 ${result.summary.createdEventCount} 条；处理订单 applied=${applied} skipped=${skipped} review=${review}`,
  );

  if (review > 0) {
    console.warn(`  ⚠ ${review} 笔订单需人工复核（多为服务类/混合单），可在后台「履约-服务派单」查看`);
  }
}
