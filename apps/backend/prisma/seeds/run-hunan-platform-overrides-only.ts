/**
 * 仅执行湖南总平台覆写（不跑完整 bootstrap / phases）。
 * 适用：已有库、仅同步租户文案 / 全量套餐 menuIds / 演示只读角色菜单 / 岗位绑定。
 *
 * 运行: `cd apps/backend && pnpm exec ts-node prisma/seeds/run-hunan-platform-overrides-only.ts`
 */

import { PrismaClient } from '@prisma/client';

import { runHunanPlatformOverrides } from './seed-hunan-platform-overrides';
import { resetPostgresSequences } from './utils/reset-postgres-sequences';

const prisma = new PrismaClient();

async function main() {
  await runHunanPlatformOverrides(prisma);
  await resetPostgresSequences(prisma);
  console.log('湖南总平台覆写完成（已尝试重置序列）。');
}

main()
  .catch((e) => {
    console.error('覆写失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
