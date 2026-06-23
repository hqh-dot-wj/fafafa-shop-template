/**
 * 历史订单履约单回填脚本。
 *
 * 默认 dry-run，不写库；只有显式传入 --apply、--tenant-id 和确认短语才会创建履约单。
 *
 * 使用（在 apps/backend 目录、已配置 DATABASE_URL）：
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/data/backfill-fulfillment-orders.ts
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/data/backfill-fulfillment-orders.ts --tenant-id=000000 --limit=50
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/data/backfill-fulfillment-orders.ts --apply --tenant-id=000000 --confirm-apply=FULFILLMENT_BACKFILL --run-id=fulfillment-backfill-20260425-000000
 */
import { OrderStatus, PrismaClient } from '@prisma/client';
import {
  DEFAULT_FULFILLMENT_BACKFILL_STATUSES,
  FULFILLMENT_BACKFILL_CONFIRMATION,
  LegacyFulfillmentBackfillOptions,
  LegacyFulfillmentBackfillRunner,
} from 'src/module/fulfillment/services/legacy-fulfillment-backfill.runner';

const HELP_TEXT = `
历史履约回填脚本

默认 dry-run，不写库。

参数:
  --apply                         执行写入；未传时只输出 dry-run 清单
  --tenant-id=<tenantId>          租户 ID；--apply 时必填
  --status=PAID,SHIPPED          订单状态列表；默认 PAID,SHIPPED,COMPLETED
  --order-sn=<keyword>            订单号模糊过滤
  --limit=<1-500>                 最多处理订单数；默认 100
  --run-id=<id>                   回填批次号，写入 event.operationId；默认自动生成
  --confirm-apply=FULFILLMENT_BACKFILL
                                  --apply 时必填，防误触
  --allow-terminal-status         允许 apply CANCELLED/REFUNDED 状态
  --help                          查看帮助

示例:
  pnpm exec ts-node -r tsconfig-paths/register scripts/data/backfill-fulfillment-orders.ts --tenant-id=000000 --limit=50
  pnpm exec ts-node -r tsconfig-paths/register scripts/data/backfill-fulfillment-orders.ts --apply --tenant-id=000000 --confirm-apply=${FULFILLMENT_BACKFILL_CONFIRMATION} --run-id=fulfillment-backfill-20260425-000000
`;

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(HELP_TEXT.trim());
    return;
  }

  const prisma = new PrismaClient();
  try {
    const runner = new LegacyFulfillmentBackfillRunner(prisma);
    const result = await runner.run(parseArgs(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function parseArgs(args: string[]): LegacyFulfillmentBackfillOptions {
  const valueOf = (name: string) => {
    const prefix = `--${name}=`;
    return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
  };

  return {
    apply: args.includes('--apply'),
    tenantId: valueOf('tenant-id'),
    statuses: parseStatuses(valueOf('status')),
    orderSn: valueOf('order-sn'),
    limit: parseLimit(valueOf('limit')),
    runId: valueOf('run-id') ?? generateRunId(),
    confirmApply: valueOf('confirm-apply'),
    allowTerminalStatus: args.includes('--allow-terminal-status'),
  };
}

function parseStatuses(value?: string): OrderStatus[] {
  if (!value) return [...DEFAULT_FULFILLMENT_BACKFILL_STATUSES];

  return value.split(',').map((rawStatus) => {
    const status = rawStatus.trim();
    if (!status) throw new Error('status 中存在空值');
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw new Error(`非法订单状态: ${status}`);
    }
    return status as OrderStatus;
  });
}

function parseLimit(value?: string): number {
  if (!value) return 100;
  const limit = Number(value);
  if (!Number.isInteger(limit)) {
    throw new Error('limit 必须是整数');
  }
  return limit;
}

function generateRunId(): string {
  const compactTime = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `fulfill-backfill-${compactTime}-${suffix}`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
