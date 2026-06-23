/**
 * 生产首次部署引导种子（非湖南全量演示）
 * - 平台骨架：租户 / 字典 / 部门 / 角色 / 菜单 / admin 用户
 * - 玩法运行时定义：PlayDispatcher 启动必需
 * - 模板品牌覆写：fafafa.app 模板部署场景，按 TEMPLATE_BRAND_* / TEMPLATE_ADMIN_* 环境变量
 *   覆写超级租户字段与默认 admin 账号（未设置环境变量时 no-op，向后兼容）
 *
 * 由以下场景调用：
 *   1. deploy/scripts/remote_deploy.sh 在 RUN_BOOTSTRAP=true 时（手工首次部署）
 *   2. deploy/scripts/template/migrate.sh 在 fafafa Pipeline migrate 步骤
 */
import { DelFlag, PrismaClient } from '@prisma/client';

import { applyTemplateBranding, runPlatformBootstrap } from './00-platform';
import { seedPlayDefinitions } from './01-hq-foundation/play-definitions';
import { resetPostgresSequences } from './utils/reset-postgres-sequences';

const ADMIN_USER = 'admin';

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    const existingAdmin = await prisma.sysUser.findFirst({
      where: { userName: ADMIN_USER, delFlag: DelFlag.NORMAL },
      select: { userId: true },
    });

    if (existingAdmin) {
      console.log('[Prod-Bootstrap] 已存在管理员，跳过平台骨架，仅补齐 play_definition');
      await seedPlayDefinitions(prisma);
    } else {
      console.log('[Prod-Bootstrap] 首次初始化平台基础数据...');
      await runPlatformBootstrap(prisma);
      await seedPlayDefinitions(prisma);
      await resetPostgresSequences(prisma);
      console.log('[Prod-Bootstrap] 平台骨架完成。默认后台账号: admin / admin123');
    }

    // 模板品牌覆写：fafafa 部署场景下生效；普通手工部署无 TEMPLATE_* 环境变量时为 no-op
    const branding = await applyTemplateBranding(prisma);
    if (branding.tenantUpdated || branding.adminUpdated) {
      console.log('[Prod-Bootstrap] 模板品牌覆写完成，默认账号已按 TEMPLATE_ADMIN_* 重置');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[Prod-Bootstrap] 失败:', error);
  process.exit(1);
});
