/**
 * Prisma Seed Data
 *
 * 平台骨架（租户/字典/菜单/用户等）见 `prisma/seeds/00-platform/`；
 * 湖南总平台默认覆写（公司名/全量套餐/演示只读角色菜单/岗位）见 `prisma/seeds/seed-hunan-platform-overrides.ts`；
 * 业务演示种子（总部→租户→选品→C端）见 `prisma/seeds/run-phases.ts`。
 *
 * 运行方式: pnpm seed / pnpm prisma:seed:only（统一湖南演示管道，见 seeds/hunan-demo-pipeline.ts）
 * 轻量入口（无 H5 联调会员/平台默认营销场景）: ts-node prisma/seeds/run-bootstrap-then-hunan-overrides.ts
 * 仅重建超级租户菜单: `pnpm prisma:reset-super-menus` 或 `ts-node prisma/seed.ts --reseed-menus-only`
 *   （`--reseed-menus-only` 会先清空租户 000000 的 sys_menu 及关联 sys_role_menu，再 createMany，避免旧数据导致接口菜单与种子不一致）
 * 平台字典：`runPlatformBootstrap` 写入前会先清空租户 000000 的 sys_dict_type / sys_dict_data，再播种，避免重复执行 seed 产生重复字典项
 * 显式「湖南总平台」入口: `pnpm prisma:seed:platform-hunan`（与 seed.ts 等价）
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
