/**
 * Prisma Seed — 湖南总平台完整入口
 *
 * 与 `prisma/seed.ts` 行为一致（共用 `seed-pipeline.ts`），单独文件便于文档与脚本显式引用。
 *
 * 运行: `cd apps/backend && pnpm exec ts-node prisma/seed-platform-hunan.ts`
 * 或根目录: `pnpm --filter @apps/backend exec ts-node prisma/seed-platform-hunan.ts`
 */

import { PrismaClient } from '@prisma/client';

import { runPrismaSeedPipeline } from './seed-pipeline';

const prisma = new PrismaClient();

async function main() {
  await runPrismaSeedPipeline(prisma, process.argv);
}

main()
  .catch((e) => {
    console.error('种子数据导入失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
