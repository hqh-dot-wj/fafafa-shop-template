/**
 * 幂等：按 delete_time 与 del_flag 对齐（删除语义以 del_flag 为准）。
 *
 * 说明：
 * - 多次执行安全：仅更新仍不一致的行。
 * - 迁移 `20260327150000_oms_order_del_flag` 已含首次 UPDATE；本脚本用于灰度后补跑或手工修复。
 *
 * 使用（在 apps/backend 目录、已配置 DATABASE_URL）：
 *   pnpm exec ts-node -r tsconfig-paths/register scripts/data/backfill-oms-order-del-flag.ts
 */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const markedDeleted = await prisma.$executeRaw`
      UPDATE "oms_order"
      SET "del_flag" = '1'
      WHERE "delete_time" IS NOT NULL AND "del_flag" = '0'
    `;
    const markedNormal = await prisma.$executeRaw`
      UPDATE "oms_order"
      SET "del_flag" = '0'
      WHERE "delete_time" IS NULL AND "del_flag" = '1'
    `;
    console.log(
      JSON.stringify({
        updatedToDelete: markedDeleted,
        updatedToNormal: markedNormal,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main();
