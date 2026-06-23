/**
 * Prisma 种子管道（被 `prisma/seed.ts` 与其他脚本复用）
 */

import type { PrismaClient } from '@prisma/client';

import { runPlatformBootstrap, seedSysMenuAndRoleMenu } from './seeds/00-platform';
import { runHunanDemoSeedPipeline } from './seeds/hunan-demo-pipeline';
import { runHunanPlatformOverrides } from './seeds/seed-hunan-platform-overrides';
import { resetPostgresSequences } from './seeds/utils/reset-postgres-sequences';
import { wipeTenantMenusAndRoleLinks } from './seeds/utils/wipe-super-tenant-menus';

function shouldRunLegacySeedPhases(argv: string[]): boolean {
  return argv.includes('--with-legacy-phases') || process.env.SEED_INCLUDE_LEGACY_PHASES === 'true';
}

export async function runPrismaSeedPipeline(prisma: PrismaClient, argv: string[]): Promise<void> {
  if (argv.includes('--reseed-menus-only')) {
    console.log('仅重播超级租户菜单（sys_menu + sys_role_menu）...');
    const removed = await wipeTenantMenusAndRoleLinks(prisma);
    console.log(`已清空租户 000000 的 ${removed} 条 sys_menu 及对应 sys_role_menu，开始写入种子...`);
    await seedSysMenuAndRoleMenu(prisma);
    await prisma.$executeRawUnsafe(`
      SELECT setval(
        pg_get_serial_sequence('sys_menu', 'menu_id'),
        (SELECT COALESCE(MAX(menu_id), 1) FROM sys_menu)
      )
    `);
    console.log('已重置 sys_menu.menu_id 序列；菜单重播种子完成。');
    await runHunanPlatformOverrides(prisma);
    return;
  }

  await runHunanDemoSeedPipeline(prisma, {
    includePlatformMarketingScenes: true,
    includeH5DemoMember: true,
    includeAcceptanceProfile: process.env.SEED_ACCEPTANCE_PROFILE === 'true',
  });

  const { seedDemoTenantAdminPermissions } = await import('./seeds/03-tenants/sync-demo-tenant-permissions');
  await seedDemoTenantAdminPermissions(prisma);

  if (shouldRunLegacySeedPhases(argv)) {
    console.warn(
      '[Seed-Pipeline] Legacy multi-tenant seed phases enabled. This may write demo data for non-000000 tenants.',
    );
    const { runSeedPhases } = await import('./seeds/run-phases');
    await runSeedPhases(prisma);
  } else {
    console.log('[Seed-Pipeline] Skip legacy multi-tenant seed phases by default (03–08 业务演示数据).');
    console.log(
      '[Seed-Pipeline] 已执行演示租户管理员套餐权限同步；创建 100001–100006 租户实体需 --with-legacy-phases。',
    );
  }

  await resetPostgresSequences(prisma);
  console.log('种子数据导入完成!');
}
